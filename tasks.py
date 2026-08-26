import os
import json
import time
import logging
import requests
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Tuple

logger = logging.getLogger(__name__)


def refresh_google_access_token(user) -> Tuple[bool, str]:
    """
    Exchanges stored refresh_token for a fresh Google access_token if expired or near expiry.
    Returns (is_success, access_token_or_error_message).
    """
    if not user:
        return False, "User record is required for token refresh."

    now_utc = datetime.now(timezone.utc)

    # 1. If existing access_token has >5 minutes remaining, use it directly
    if user.access_token and user.token_expires_at:
        exp = user.token_expires_at.replace(tzinfo=timezone.utc) if user.token_expires_at.tzinfo is None else user.token_expires_at
        if exp > now_utc + timedelta(minutes=5):
            return True, user.get_decrypted_access_token()

    # 2. Check for refresh token
    decrypted_refresh = user.get_decrypted_refresh_token()
    if not decrypted_refresh:
        # Fall back to access token if present
        if user.access_token:
            return True, user.get_decrypted_access_token()
        return False, "No Google OAuth refresh token or active access token found. Please reconnect YouTube."

    client_id = os.getenv('GOOGLE_OAUTH_CLIENT_ID', '').strip()
    client_secret = os.getenv('GOOGLE_OAUTH_CLIENT_SECRET', '').strip()

    token_url = 'https://oauth2.googleapis.com/token'
    payload = {
        'client_id': client_id,
        'refresh_token': decrypted_refresh,
        'grant_type': 'refresh_token'
    }
    if client_secret:
        payload['client_secret'] = client_secret

    try:
        logger.info(f"Refreshing Google OAuth access token for user {user.id} via refresh_token...")
        res = requests.post(token_url, data=payload, timeout=15)
        if res.status_code == 200:
            data = res.json()
            new_access_token = data.get('access_token')
            expires_in = int(data.get('expires_in', 3600))

            user.set_access_token(new_access_token)
            user.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
            user.updated_at = datetime.now(timezone.utc)
            logger.info(f"Successfully renewed access token for user {user.id} (expires in {expires_in}s).")
            return True, new_access_token
        else:
            err_data = res.json() if res.text else {}
            err_msg = err_data.get('error_description') or err_data.get('error') or f"HTTP {res.status_code}"
            logger.error(f"Failed to refresh Google access token for user {user.id}: {err_msg}")
            # If refresh failed but we still have an access token, attempt it as last resort
            if user.access_token:
                return True, user.get_decrypted_access_token()
            return False, f"Google token refresh failed: {err_msg}. Please reconnect your YouTube account."
    except Exception as e:
        logger.error(f"Exception during Google token refresh for user {user.id}: {e}")
        if user.access_token:
            return True, user.get_decrypted_access_token()
        return False, f"Token renewal network error: {str(e)}"


def validate_google_token(access_token: str) -> Tuple[bool, str]:
    """
    Validates the OAuth access token against Google's tokeninfo endpoint.
    Verifies that the token is unexpired and has YouTube upload permissions.
    Returns (is_valid, message).
    """
    if not access_token or not isinstance(access_token, str) or len(access_token.strip()) < 10:
        return False, "Missing or malformed Google OAuth access token."

    tokeninfo_url = f"https://oauth2.googleapis.com/tokeninfo?access_token={access_token.strip()}"
    try:
        response = requests.get(tokeninfo_url, timeout=10)
        if response.status_code != 200:
            err_data = response.json() if response.text else {}
            err_msg = err_data.get('error_description') or err_data.get('error') or f"HTTP {response.status_code}"
            return False, f"Google authentication failed: {err_msg}. Please reconnect your YouTube account."

        token_info = response.json()
        expires_in = int(token_info.get('expires_in', 0))
        if expires_in <= 10:
            return False, "Google access token has expired. Please reconnect YouTube in the top bar."

        scope = token_info.get('scope', '')
        if 'youtube' not in scope and 'youtube.upload' not in scope:
            return False, "Access token lacks YouTube upload permissions. Please re-authorize with YouTube permissions."

        return True, "Token valid"
    except requests.exceptions.RequestException as net_err:
        logger.warning(f"Google token validation check network warning: {net_err}")
        return True, "Validation bypassed due to transient network latency"


def upload_clip_to_youtube(clip, access_token: str, max_retries: int = 2) -> dict:
    """
    Uploads clip file to YouTube Shorts via YouTube Data API v3 with resilient retry logic
    and friendly error diagnostics.
    """
    if not clip.file_path or not os.path.exists(clip.file_path):
        return {'success': False, 'error': f"Video clip file not found on disk at {clip.file_path}."}

    if os.path.getsize(clip.file_path) == 0:
        return {'success': False, 'error': "Generated clip file is empty (0 bytes)."}

    # Verify token before uploading
    is_valid, token_msg = validate_google_token(access_token)
    if not is_valid:
        return {'success': False, 'error': token_msg}

    video_metadata = {
        'snippet': {
            'title': clip.title[:100],  # YouTube title limit is 100 chars
            'description': clip.description[:5000],
            'tags': clip.get_tags()[:20],
            'categoryId': '22'  # People & Blogs
        },
        'status': {
            'privacyStatus': clip.privacy_status if clip.privacy_status in ['public', 'unlisted', 'private'] else 'public',
            'selfDeclaredMadeForKids': False
        }
    }

    headers = {
        'Authorization': f'Bearer {access_token.strip()}',
        'Accept': 'application/json'
    }

    upload_url = 'https://www.googleapis.com/upload/youtube/v3/videos'
    params = {
        'part': 'snippet,status',
        'uploadType': 'multipart'
    }

    last_error = "Upload failed"

    for attempt in range(1, max_retries + 2):
        try:
            logger.info(f"Uploading clip {clip.id} to YouTube Shorts (Attempt {attempt}/{max_retries + 1})...")
            with open(clip.file_path, 'rb') as video_file:
                files = {
                    'metadata': ('metadata.json', json.dumps(video_metadata), 'application/json'),
                    'media': (f'clip_{clip.id}.mp4', video_file, 'video/mp4')
                }
                response = requests.post(upload_url, headers=headers, params=params, files=files, timeout=300)

            if response.status_code == 200:
                result = response.json()
                video_id = result.get('id')
                short_url = f'https://youtube.com/shorts/{video_id}'
                logger.info(f"Successfully published clip {clip.id} to YouTube: {short_url}")
                return {
                    'success': True,
                    'video_id': video_id,
                    'url': short_url,
                    'message': f'Uploaded successfully ({clip.privacy_status})'
                }

            # Parse error details from Google API
            err_text = response.text
            err_reason = ""
            try:
                err_json = response.json()
                errors_list = err_json.get('error', {}).get('errors', [])
                if errors_list:
                    err_reason = errors_list[0].get('reason', '')
                    err_text = errors_list[0].get('message', err_text)
                else:
                    err_text = err_json.get('error', {}).get('message', err_text)
            except Exception:
                pass

            if err_reason == 'uploadLimitExceeded' or 'upload limit' in err_text.lower():
                return {
                    'success': False,
                    'error': 'YouTube daily upload limit reached for this channel. YouTube limits new accounts to a few uploads per day. Please try again tomorrow or download the MP4 manually.'
                }

            if err_reason == 'quotaExceeded' or 'quota' in err_text.lower():
                return {
                    'success': False,
                    'error': 'YouTube API quota reached for today. You can still download clips directly to your computer.'
                }

            if response.status_code in (401, 403):
                return {
                    'success': False,
                    'error': f"YouTube authorization rejected: {err_text}. Please reconnect YouTube in the top bar."
                }

            last_error = f"YouTube API Error ({response.status_code}): {err_text}"
            logger.warning(f"Upload attempt {attempt} failed for clip {clip.id}: {last_error}")

        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as conn_err:
            last_error = f"Network connection drop during video upload: {str(conn_err)}"
            logger.warning(f"Network error on attempt {attempt} for clip {clip.id}: {last_error}")
            if attempt <= max_retries:
                time.sleep(2 * attempt)
                continue

        except Exception as e:
            last_error = f"Unexpected upload error: {str(e)}"
            logger.error(f"Exception uploading clip {clip.id}: {e}", exc_info=True)
            break

    return {'success': False, 'error': last_error}


def process_job_task(job_id: str, access_token: str, app_factory_func=None):
    """
    Background job processor for YouTube upload pipeline with lightweight app context.
    """
    from app_factory import create_app
    from models import db, Job, Clip
    from services.video_service import extract_and_cut_segment

    app = create_app()
    with app.app_context():
        # Outer safety net: any unhandled exception at any stage marks the job
        # failed and rolls back so the next request gets a clean DB session.
        try:
            job = db.session.query(Job).filter_by(id=job_id).first()
            if not job:
                logger.error(f"Job {job_id} not found in DB.")
                return

            # Pre-validate token before long pipeline execution
            is_token_valid, token_msg = validate_google_token(access_token)
            if not is_token_valid:
                job.status = 'failed'
                job.error_message = token_msg
                job.updated_at = datetime.now(timezone.utc)
                db.session.commit()
                return

            job.status = 'processing'
            job.updated_at = datetime.now(timezone.utc)
            db.session.commit()

            clips = db.session.query(Clip).filter_by(job_id=job_id).all()
            if not clips:
                logger.error(f"No clips associated with job {job_id}")
                job.status = 'failed'
                job.error_message = 'No clips associated with this upload job.'
                db.session.commit()
                return

            clips_folder = os.path.join(app.root_path, 'clips')
            os.makedirs(clips_folder, exist_ok=True)
            any_success = False

            for clip in clips:
                output_clip_path = os.path.join(clips_folder, f'clip_{clip.id}.mp4')
                raw_clip_path = os.path.join(clips_folder, f'raw_clip_{clip.id}.mp4')

                clip.status = 'downloading'
                db.session.commit()

                # Sub-step 1 & 2: Segment extraction & formatting
                try:
                    clip.status = 'processing'
                    db.session.commit()

                    # If finalized clip already exists on disk, reuse it
                    if not (os.path.exists(output_clip_path) and os.path.getsize(output_clip_path) > 0):
                        extract_and_cut_segment(
                            video_url=clip.video_url,
                            clip_id=str(clip.id),
                            start_seconds=clip.start_seconds,
                            end_seconds=clip.end_seconds,
                            clips_folder=clips_folder,
                            output_clip_path=raw_clip_path
                        )

                        duration = max(1.0, clip.end_seconds - clip.start_seconds)

                        # Sub-step 2b: Process Animated Captions if enabled
                        if getattr(clip, 'has_captions', True):
                            from services.caption_service import process_clip_captions
                            logger.info(f"Processing captions for clip {clip.id} (style: {clip.caption_style})...")
                            process_clip_captions(
                                clip_video_path=raw_clip_path,
                                output_video_path=output_clip_path,
                                fallback_transcript=clip.description,
                                clip_duration=duration,
                                caption_style=clip.caption_style or 'tiktok_pop',
                                caption_font=clip.caption_font or 'Arial Black',
                                caption_color=clip.caption_color or '#FFFF00',
                                caption_language=clip.caption_language or 'auto',
                                temp_dir=clips_folder
                            )
                            if os.path.exists(raw_clip_path):
                                try:
                                    os.remove(raw_clip_path)
                                except OSError as del_err:
                                    logger.warning(f"Could not remove temp file {raw_clip_path}: {del_err}")
                        else:
                            if os.path.exists(output_clip_path):
                                try:
                                    os.remove(output_clip_path)
                                except OSError:
                                    pass
                            os.rename(raw_clip_path, output_clip_path)

                    clip.file_path = output_clip_path
                    db.session.commit()

                except Exception as cut_err:
                    error_msg = f"Video rendering failed: {str(cut_err)}"
                    logger.error(f"Clip {clip.id} processing error: {error_msg}")
                    clip.status = 'failed'
                    clip.error_message = error_msg
                    db.session.commit()
                    # Clean up any leftover temporary files
                    if os.path.exists(raw_clip_path):
                        try:
                            os.remove(raw_clip_path)
                        except OSError as del_err:
                            logger.warning(f"Could not remove temp file {raw_clip_path}: {del_err}")
                    continue

                # Sub-step 3: Upload to YouTube Shorts
                clip.status = 'uploading'
                db.session.commit()

                upload_result = upload_clip_to_youtube(clip, access_token)
                if upload_result['success']:
                    clip.status = 'completed'
                    clip.youtube_url = upload_result.get('url')
                    clip.error_message = None
                    any_success = True
                else:
                    clip.status = 'failed'
                    clip.error_message = upload_result.get('error', 'Upload failed')

                db.session.commit()

            job.status = 'completed' if any_success else 'failed'
            job.updated_at = datetime.now(timezone.utc)
            if not any_success and not job.error_message:
                job.error_message = "All clip uploads failed. Check individual clip errors."
            db.session.commit()

        except Exception as unhandled_err:
            # Safety net: mark job failed and roll back any partial transaction
            # so the next request starts with a clean DB session.
            logger.error(
                f"Unhandled exception in process_job_task for job {job_id}: {unhandled_err}",
                exc_info=True
            )
            try:
                db.session.rollback()
                job_record = db.session.query(Job).filter_by(id=job_id).first()
                if job_record and job_record.status not in ('completed', 'failed'):
                    job_record.status = 'failed'
                    job_record.error_message = "Internal processing error. Check server logs."
                    db.session.commit()
            except Exception as rollback_err:
                logger.error(f"Rollback also failed for job {job_id}: {rollback_err}")



