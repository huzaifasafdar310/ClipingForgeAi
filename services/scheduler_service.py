import os
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

# Global singleton BackgroundScheduler instance
scheduler = BackgroundScheduler(daemon=True)


def parse_time_string(time_str: str) -> tuple:
    """Parses 'HH:MM' into (hour, minute). Defaults to (14, 0)."""
    try:
        if time_str and ':' in time_str:
            parts = time_str.strip().split(':')
            hour = int(parts[0]) % 24
            minute = int(parts[1]) % 60
            return hour, minute
    except Exception:
        pass
    return 14, 0


def execute_schedule_rule(rule_id: int):
    """
    Executes the automated unattended pipeline for a single ScheduleRule:
    1. Renews user's Google OAuth access token via refresh token.
    2. Discovers new Creative Commons videos from configured Source Channels.
    3. Dedupes against ProcessedSourceVideo.
    4. Runs full pipeline (AI Highlights -> FFmpeg 9:16 Crop -> Faster-Whisper Captions -> YouTube Shorts Upload).
    5. Records audit log in ScheduledJobRun.
    """
    from app_factory import create_app
    from models import db, User, SourceChannel, ScheduleRule, ScheduledJobRun, ProcessedSourceVideo, Clip
    from tasks import refresh_google_access_token, upload_clip_to_youtube
    from services.discovery_service import fetch_new_cc_videos_for_channel
    from services.transcript_service import fetch_youtube_transcript, format_transcript_for_prompt
    from services.ai_service import analyze_transcript_highlights, generate_ai_clip_metadata, seconds_to_timestamp
    from services.video_service import extract_and_cut_segment
    from services.caption_service import process_clip_captions

    app = create_app()
    with app.app_context():
        rule = db.session.query(ScheduleRule).filter_by(id=rule_id).first()
        if not rule or not rule.is_active:
            logger.info(f"Schedule rule {rule_id} is disabled or missing. Skipping run.")
            return

        user = db.session.query(User).filter_by(id=rule.user_id).first()
        if not user:
            logger.error(f"User {rule.user_id} for rule {rule_id} not found.")
            return

        # Initialize audit run record
        run_record = ScheduledJobRun(
            schedule_rule_id=rule.id,
            status='running',
            triggered_at=datetime.now(timezone.utc)
        )
        db.session.add(run_record)
        db.session.commit()

        logger.info(f"Starting Scheduled Auto-Publishing run #{run_record.id} for rule '{rule.name}' (User: {user.name or user.id})...")

        # 1. Refresh OAuth token for unattended upload
        is_token_valid, access_token = refresh_google_access_token(user)
        if not is_token_valid:
            run_record.status = 'failed'
            run_record.error_message = f"OAuth Authorization Error: {access_token}"
            run_record.completed_at = datetime.now(timezone.utc)
            db.session.commit()
            logger.error(f"Scheduled run #{run_record.id} aborted: {access_token}")
            return

        # 2. Resolve target source channels
        channel_ids_list = rule.get_source_channel_ids()
        if not channel_ids_list:
            # Fallback to all active channels added by this user
            channels = db.session.query(SourceChannel).filter_by(added_by_user_id=user.id, is_active=True).all()
        else:
            channels = db.session.query(SourceChannel).filter(SourceChannel.id.in_(channel_ids_list), SourceChannel.is_active.is_(True)).all()

        if not channels:
            run_record.status = 'skipped'
            run_record.error_message = "No active source channels configured for this rule."
            run_record.completed_at = datetime.now(timezone.utc)
            db.session.commit()
            return

        clips_folder = os.path.join(app.root_path, 'clips')
        os.makedirs(clips_folder, exist_ok=True)

        processed_videos_summary = []
        total_clips_published = 0
        quota_hit = False

        # Hard guardrails: Max 3 source videos, max 5 total clips per scheduled run
        max_videos = min(max(rule.max_videos_per_run, 1), 3)
        max_clips_limit = 5

        # 3. Process source channels
        for channel in channels:
            if quota_hit or len(processed_videos_summary) >= max_videos:
                break

            last_checked = channel.last_checked_at or (datetime.now(timezone.utc) - timedelta(days=7))
            new_videos = fetch_new_cc_videos_for_channel(
                channel.channel_id,
                published_after=last_checked,
                max_results=3,
                license_filter=channel.license_filter or 'all'
            )

            # Update channel's last checked timestamp
            channel.last_checked_at = datetime.now(timezone.utc)
            db.session.commit()

            for vid in new_videos:
                if quota_hit or len(processed_videos_summary) >= max_videos or total_clips_published >= max_clips_limit:
                    break

                yt_vid_id = vid['video_id']
                # Check deduplication table
                already_processed = db.session.query(ProcessedSourceVideo).filter_by(
                    youtube_video_id=yt_vid_id
                ).first()
                if already_processed:
                    continue

                logger.info(f"Processing candidate Creative Commons video: '{vid['title']}' ({yt_vid_id}) from channel '{channel.channel_title}'...")

                video_summary = {
                    'video_id': yt_vid_id,
                    'title': vid['title'],
                    'channel_title': channel.channel_title,
                    'published_shorts': [],
                    'errors': []
                }

                try:
                    # 3a. Extract transcript
                    transcript_raw = fetch_youtube_transcript(yt_vid_id)
                    transcript_formatted = format_transcript_for_prompt(transcript_raw) if transcript_raw else None

                    # Calculate true duration from transcript or default to 600s
                    duration_seconds = 600.0
                    if transcript_raw and len(transcript_raw) > 0:
                        try:
                            last_item = transcript_raw[-1]
                            duration_seconds = float(last_item.get('start', 0)) + float(last_item.get('duration', 10))
                        except Exception:
                            duration_seconds = 600.0

                    # 3b. AI Highlight Discovery
                    num_clips = min(max(rule.num_clips_per_video, 1), 3)
                    highlight_segments = analyze_transcript_highlights(
                        video_id=yt_vid_id,
                        transcript_formatted=transcript_formatted,
                        duration_seconds=duration_seconds,
                        title=vid['title'],
                        description=vid['description'],
                        num_clips=num_clips
                    )

                    video_success = False

                    # 3c. Cut, caption, and publish each highlight clip
                    for idx, seg in enumerate(highlight_segments, start=1):
                        if total_clips_published >= max_clips_limit or quota_hit:
                            break

                        s_sec = seg['start_seconds']
                        e_sec = seg['end_seconds']
                        clip_dur = max(1.0, e_sec - s_sec)

                        # Guardrail: Check bounds (10s to 120s)
                        if clip_dur < 10.0 or clip_dur > 180.0:
                            continue

                        start_ts = seconds_to_timestamp(s_sec)
                        end_ts = seconds_to_timestamp(e_sec)

                        ai_meta = generate_ai_clip_metadata(
                            original_title=vid['title'],
                            original_description=vid['description'],
                            transcript_snippet='',
                            start_timestamp=start_ts,
                            end_timestamp=end_ts,
                            clip_number=idx
                        )

                        # Create temporary Clip database record for tracking
                        new_clip = Clip(
                            user_id=user.id,
                            clip_id_num=idx,
                            video_id=yt_vid_id,
                            video_url=vid['video_url'],
                            start_time=start_ts,
                            end_time=end_ts,
                            start_seconds=s_sec,
                            end_seconds=e_sec,
                            title=ai_meta['title'][:100],
                            description=ai_meta['description'][:2000],
                            suggested_tags=json.dumps(ai_meta['tags']),
                            reasoning=seg.get('reasoning', ''),
                            privacy_status=rule.privacy_status or 'public',
                            status='processing',
                            has_captions=True,
                            caption_style=rule.caption_style or 'tiktok_pop',
                            caption_font=rule.caption_font or 'Arial Black',
                            caption_color=rule.caption_color or '#FFFF00',
                            caption_language='auto'
                        )
                        db.session.add(new_clip)
                        db.session.commit()

                        raw_clip_path = os.path.join(clips_folder, f"raw_sched_{new_clip.id}.mp4")
                        final_clip_path = os.path.join(clips_folder, f"clip_{new_clip.id}.mp4")

                        try:
                            # Extract segment
                            extract_and_cut_segment(
                                video_url=vid['video_url'],
                                clip_id=f"sched_{new_clip.id}",
                                start_seconds=s_sec,
                                end_seconds=e_sec,
                                clips_folder=clips_folder,
                                output_clip_path=raw_clip_path
                            )

                            # Burn captions
                            process_clip_captions(
                                clip_video_path=raw_clip_path,
                                output_video_path=final_clip_path,
                                fallback_transcript=vid['description'],
                                clip_duration=clip_dur,
                                caption_style=new_clip.caption_style,
                                caption_font=new_clip.caption_font,
                                caption_color=new_clip.caption_color,
                                caption_language=new_clip.caption_language,
                                temp_dir=clips_folder
                            )
                            if os.path.exists(raw_clip_path):
                                os.remove(raw_clip_path)

                            new_clip.file_path = final_clip_path
                            db.session.commit()

                            # Upload to YouTube Shorts
                            upload_res = upload_clip_to_youtube(new_clip, access_token)
                            if upload_res.get('success'):
                                short_url = upload_res.get('url')
                                new_clip.status = 'completed'
                                new_clip.youtube_url = short_url
                                db.session.commit()

                                video_summary['published_shorts'].append({
                                    'clip_id': new_clip.id,
                                    'title': new_clip.title,
                                    'url': short_url
                                })
                                total_clips_published += 1
                                video_success = True
                                logger.info(f"Published scheduled Short: {short_url}")
                            else:
                                err = upload_res.get('error', 'Upload failed')
                                new_clip.status = 'failed'
                                new_clip.error_message = err
                                db.session.commit()
                                video_summary['errors'].append(err)

                                if 'uploadLimitExceeded' in err or 'quota' in err.lower() or 'upload limit' in err.lower():
                                    quota_hit = True
                                    logger.warning("YouTube quota/upload limit reached in scheduled run. Stopping further uploads.")
                                    break

                        except Exception as clip_err:
                            logger.error(f"Error processing clip {new_clip.id}: {clip_err}", exc_info=True)
                            new_clip.status = 'failed'
                            new_clip.error_message = str(clip_err)
                            db.session.commit()
                            video_summary['errors'].append(str(clip_err))
                            if os.path.exists(raw_clip_path):
                                try:
                                    os.remove(raw_clip_path)
                                except Exception:
                                    pass

                    # Record in de-duplication table if successfully processed or attempted
                    dedupe_entry = ProcessedSourceVideo(
                        source_channel_id=channel.id,
                        youtube_video_id=yt_vid_id,
                        video_title=vid['title']
                    )
                    db.session.add(dedupe_entry)
                    db.session.commit()

                    processed_videos_summary.append(video_summary)

                except Exception as vid_err:
                    logger.error(f"Error processing source video {yt_vid_id}: {vid_err}", exc_info=True)
                    video_summary['errors'].append(str(vid_err))
                    processed_videos_summary.append(video_summary)

        # 4. Finalize audit run record
        run_record.completed_at = datetime.now(timezone.utc)
        run_record.set_source_videos_processed(processed_videos_summary)

        if total_clips_published > 0:
            run_record.status = 'completed'
        elif quota_hit:
            run_record.status = 'failed'
            run_record.error_message = "YouTube daily upload limit or project quota reached."
        elif not processed_videos_summary:
            run_record.status = 'completed'
            run_record.error_message = "Checked channels: No new Creative Commons uploads found."
        else:
            run_record.status = 'completed' if any(len(v['published_shorts']) > 0 for v in processed_videos_summary) else 'failed'

        rule.last_run_at = datetime.now(timezone.utc)
        db.session.commit()

        logger.info(f"Finished scheduled run #{run_record.id}. Published {total_clips_published} Shorts. Status: {run_record.status}")


def schedule_job_for_rule(rule_id: int):
    """Registers or updates an APScheduler job for a specific ScheduleRule."""
    from app_factory import create_app
    from models import db, ScheduleRule

    job_id = f"rule_{rule_id}"

    # Remove existing job if already scheduled
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)

    app = create_app()
    with app.app_context():
        rule = db.session.query(ScheduleRule).filter_by(id=rule_id).first()
        if not rule or not rule.is_active:
            return

        hour, minute = parse_time_string(rule.run_at_time)

        if rule.frequency == 'hourly':
            trigger = IntervalTrigger(hours=1)
        elif rule.frequency == 'weekly':
            trigger = CronTrigger(day_of_week='mon', hour=hour, minute=minute)
        else:  # 'daily' default
            trigger = CronTrigger(hour=hour, minute=minute)

        scheduler.add_job(
            func=execute_schedule_rule,
            trigger=trigger,
            args=[rule.id],
            id=job_id,
            name=f"AutoPublish_{rule.name}",
            replace_existing=True,
            misfire_grace_time=3600
        )
        logger.info(f"Registered APScheduler job '{job_id}' ({rule.frequency} at {hour:02d}:{minute:02d}) for rule #{rule.id}")


def remove_scheduled_job(rule_id: int):
    """Removes an APScheduler job when a rule is deleted or disabled."""
    job_id = f"rule_{rule_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
        logger.info(f"Removed APScheduler job '{job_id}'")


def start_scheduler():
    """Initializes and starts the BackgroundScheduler daemon."""
    if not scheduler.running:
        scheduler.start()
        logger.info("APScheduler BackgroundScheduler started successfully.")


def pause_scheduler():
    """Pauses the scheduler from triggering new jobs."""
    if scheduler.running:
        scheduler.pause()
        logger.info("APScheduler paused.")


def resume_scheduler():
    """Resumes the scheduler."""
    if not scheduler.running:
        scheduler.start()
    else:
        scheduler.resume()
    logger.info("APScheduler resumed.")


def get_scheduler_info() -> dict:
    """Returns current scheduler operational metrics and job schedules."""
    is_running = scheduler.running and getattr(scheduler, 'state', 1) == 1
    jobs = scheduler.get_jobs()
    next_run = None
    if jobs:
        valid_next_runs = [j.next_run_time for j in jobs if j.next_run_time]
        if valid_next_runs:
            next_run = min(valid_next_runs).isoformat()

    return {
        'is_running': bool(is_running),
        'state': 'running' if is_running else 'paused',
        'jobs_count': len(jobs),
        'next_run_time': next_run,
        'active_jobs': [{'id': j.id, 'name': j.name, 'next_run': j.next_run_time.isoformat() if j.next_run_time else None} for j in jobs]
    }


def sync_all_active_rules():
    """Loads all active ScheduleRules from database on startup and registers jobs."""
    from app_factory import create_app
    from models import db, ScheduleRule

    start_scheduler()

    app = create_app()
    with app.app_context():
        active_rules = db.session.query(ScheduleRule).filter_by(is_active=True).all()
        for rule in active_rules:
            schedule_job_for_rule(rule.id)
        logger.info(f"Synchronized {len(active_rules)} active schedule rules with APScheduler.")
