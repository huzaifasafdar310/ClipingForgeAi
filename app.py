import os
import re
import json
import uuid
import html
import hmac
import logging
import subprocess
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor

from flask import Flask, request, jsonify, send_file, send_from_directory, session
from werkzeug.utils import secure_filename
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv
import requests
import redis
from rq import Queue

from models import (
    db, User, Job, Clip, SourceChannel, ScheduleRule, ScheduledJobRun, ProcessedSourceVideo,
    cleanup_old_data, auto_migrate_schema
)
from app_factory import create_app
from services.transcript_service import fetch_youtube_transcript, format_transcript_for_prompt
from services.ai_service import analyze_transcript_highlights, generate_ai_clip_metadata, seconds_to_timestamp, timestamp_to_seconds
from services.video_service import (
    get_ffmpeg_path,
    get_ffprobe_path,
    extract_and_cut_segment
)
from services.discovery_service import discover_creative_commons_channels, fetch_new_cc_videos_for_channel
from services.scheduler_service import (
    sync_all_active_rules, schedule_job_for_rule, remove_scheduled_job, execute_schedule_rule
)
from tasks import process_job_task, validate_google_token, refresh_google_access_token

# Configure logging
logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(levelname)s in %(module)s: %(message)s')
logger = logging.getLogger(__name__)

# Initialize Application via Factory
app = create_app()

ALLOWED_VIDEO_EXTENSIONS = {'mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'flv'}

# Bounded Worker Pool for fallback thread execution (Cap concurrency to 3)
job_executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="clipai_worker_")

def allowed_video_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_VIDEO_EXTENSIONS

def sanitize_input_text(text: str, max_length: int = 500) -> str:
    """Strips HTML markup and escapes characters to prevent Stored XSS."""
    if not text or not isinstance(text, str):
        return ""
    clean = re.sub(r'<[^>]*>', '', text.strip())
    escaped = html.escape(clean)
    return escaped[:max_length]


VALID_TIME_RE = re.compile(r'^(?:[01]\d|2[0-3]):[0-5]\d$')


def validate_run_at_time(value: str) -> str:
    """Validates a 'HH:MM' 24-hour time string. Returns the value if valid, else '14:00'."""
    if isinstance(value, str) and VALID_TIME_RE.match(value.strip()):
        return value.strip()
    return '14:00'


def safe_error_message(exc: Exception, dev_detail: bool = False) -> str:
    """Returns a safe error string for API responses.

    In production: returns a generic message so internal paths / stack traces
    are never exposed to clients.  In development (dev_detail=True) the raw
    exception string is returned for easier debugging.
    """
    flask_env = os.getenv('FLASK_ENV', 'development').lower()
    if flask_env == 'production':
        return 'An internal error occurred. Please try again or contact support.'
    return str(exc)


def get_current_user_id() -> str:
    """
    Retrieves the active user ID from the signed server session,
    or generates a new anonymous session UUID and stores it.
    """
    if 'user_id' not in session:
        session['user_id'] = f"usr_{uuid.uuid4().hex[:16]}"
        session.permanent = True
    return session['user_id']

with app.app_context():
    db.create_all()
    auto_migrate_schema(db.engine)
    # Perform 24-hour cleanup on startup
    clips_folder = os.path.join(app.root_path, 'clips')
    cleanup_old_data(db.session, clips_folder, hours=24)
    # Synchronize active Schedule Rules with APScheduler
    try:
        sync_all_active_rules()
    except Exception as sched_err:
        logger.warning(f"Note synchronizing scheduler rules on startup: {sched_err}")

# Redis Queue & Rate Limiter Initialization with verified connection and graceful fallback
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
redis_conn = None
rq_queue = None
limiter_storage = "memory://"

try:
    redis_conn = redis.from_url(REDIS_URL, socket_timeout=1)
    redis_conn.ping()
    rq_queue = Queue('yt_upl2_jobs', connection=redis_conn)
    limiter_storage = REDIS_URL
    logger.info("Connected to Redis: RQ Queue and Rate Limiting active.")
except Exception as redis_err:
    logger.warning(f"Redis unavailable ({redis_err}). Rate limiter using memory:// and jobs using bounded ThreadPool.")
    redis_conn = None
    rq_queue = None

def get_rate_limit_key() -> str:
    """
    Returns a composite rate limit key combining client IP and authenticated/session user_id.
    Prevents bypassing rate limits simply by clearing cookies or rotating IP headers.
    """
    ip = get_remote_address()
    user_id = session.get('user_id')
    if user_id:
        return f"{ip}:{user_id}"
    return ip

# Initialize Rate Limiter with Composite User/IP Key
limiter = Limiter(
    key_func=get_rate_limit_key,
    app=app,
    default_limits=["300 per day", "100 per hour"],
    storage_uri=limiter_storage
)

# Regex for YouTube URL Validation
YOUTUBE_URL_REGEX = re.compile(
    r'^(https?://)?(www\.)?(youtube\.com/(watch\?v=|shorts/)|youtu\.be/)([a-zA-Z0-9_-]{11})(\S*)?$'
)

def extract_video_id(url: str):
    """Strict YouTube URL extraction and validation."""
    if not url or not isinstance(url, str):
        return None
    match = YOUTUBE_URL_REGEX.search(url.strip())
    if match:
        return match.group(5)
    return None

def get_video_metadata(video_id: str):
    """Retrieve video metadata from YouTube API."""
    api_key = os.getenv('YOUTUBE_API_KEY')
    if not api_key:
        raise Exception("YOUTUBE_API_KEY is not configured in .env file.")

    url = 'https://www.googleapis.com/youtube/v3/videos'
    params = {
        'part': 'snippet,statistics,contentDetails',
        'id': video_id,
        'key': api_key
    }

    try:
        response = requests.get(url, params=params, timeout=10)
    except requests.exceptions.RequestException as net_err:
        raise Exception(f"Network error contacting YouTube API: {net_err}")

    if response.status_code == 403:
        err_text = response.text
        if 'quotaExceeded' in err_text or 'rateLimitExceeded' in err_text:
            raise Exception("YouTube Data API quota reached for today. You can still upload local MP4 files directly.")
        raise Exception("YouTube API request rejected (403 Forbidden). Please check your YOUTUBE_API_KEY.")

    if response.status_code != 200:
        raise Exception(f"YouTube API responded with error {response.status_code}.")

    data = response.json()
    if not data.get('items'):
        raise Exception('YouTube video not found, private, or age-restricted.')

    item = data['items'][0]
    snippet = item['snippet']
    content_details = item.get('contentDetails', {})

    return {
        'title': sanitize_input_text(snippet.get('title', 'YouTube Video'), max_length=200),
        'description': sanitize_input_text(snippet.get('description', ''), max_length=2000),
        'thumbnail': snippet.get('thumbnails', {}).get('high', {}).get('url', '') or snippet.get('thumbnails', {}).get('default', {}).get('url', ''),
        'duration': content_details.get('duration', 'PT0S'),
        'video_id': video_id
    }

def parse_duration(duration_str: str) -> int:
    """Parse YouTube ISO 8601 duration format (PT1H2M3S) to total seconds."""
    pattern = r'PT(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+)S)?'
    match = re.match(pattern, duration_str)
    if not match:
        return 0
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    seconds = int(match.group(3) or 0)
    return hours * 3600 + minutes * 60 + seconds

def probe_local_video_duration(file_path: str) -> float:
    """Cross-platform duration probe using ffprobe / ffmpeg."""
    ffprobe_exe = get_ffprobe_path()
    try:
        result = subprocess.run(
            [ffprobe_exe, '-v', 'quiet', '-print_format', 'json',
             '-show_format', '-show_streams', file_path],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0 and result.stdout:
            info = json.loads(result.stdout)
            duration = float(info.get('format', {}).get('duration', 0))
            if duration > 0:
                return duration
            for stream in info.get('streams', []):
                d = float(stream.get('duration', 0))
                if d > 0:
                    return d
    except Exception as e:
        logger.warning(f"ffprobe failed ({e}), falling back to ffmpeg duration probe.")

    ffmpeg_exe = get_ffmpeg_path()
    try:
        result2 = subprocess.run(
            [ffmpeg_exe, '-i', file_path],
            capture_output=True, text=True, timeout=30
        )
        m = re.search(r'Duration:\s*(\d+):(\d+):([\d.]+)', result2.stderr)
        if m:
            h, mn, s = int(m.group(1)), int(m.group(2)), float(m.group(3))
            return h * 3600 + mn * 60 + s
    except Exception as e2:
        logger.error(f"FFmpeg duration probe also failed: {e2}")
    return 0


FRONTEND_DIST = os.path.join(app.root_path, 'frontend', 'dist')

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react_app(path):
    """Serve React frontend static assets and client-side SPA fallback."""
    get_current_user_id()
    if path != "" and os.path.exists(os.path.join(FRONTEND_DIST, path)):
        return send_from_directory(FRONTEND_DIST, path)
    if os.path.exists(os.path.join(FRONTEND_DIST, 'index.html')):
        return send_from_directory(FRONTEND_DIST, 'index.html')
    return "Frontend build not found. Run 'npm run build' inside frontend directory.", 404


@app.route('/api/config')
@limiter.exempt
def get_public_config():
    """Returns non-sensitive configuration such as Google OAuth Client ID."""
    # Security: Never fall back to a real hardcoded Client ID.
    # If GOOGLE_OAUTH_CLIENT_ID is unset, return empty string — the frontend
    # will show a configuration error rather than using a leaked credential.
    return jsonify({
        'google_client_id': os.getenv('GOOGLE_OAUTH_CLIENT_ID', '')
    })


@app.route('/api/auth/me', methods=['GET'])
@limiter.exempt
def get_auth_me():
    """Retrieve current session user from the database."""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'is_authenticated': False, 'user': None})

    user = db.session.query(User).filter_by(id=user_id).first()
    if not user or not user.access_token:
        return jsonify({'is_authenticated': False, 'user': None})

    # Check token expiry if set
    now_utc = datetime.now(timezone.utc)
    if user.token_expires_at:
        exp = user.token_expires_at.replace(tzinfo=timezone.utc) if user.token_expires_at.tzinfo is None else user.token_expires_at
        if exp < now_utc:
            return jsonify({'is_authenticated': False, 'user': None, 'message': 'Session token expired'})

    decrypted_token = user.get_decrypted_access_token()
    return jsonify({
        'is_authenticated': True,
        'user': user.to_dict(),
        'access_token': decrypted_token
    })


@app.route('/api/auth/login', methods=['POST'])
@limiter.limit("20 per minute")
def auth_login():
    """
    Persists user credentials and token to database so the user stays logged in across visits.
    """
    data = request.json or {}
    access_token = data.get('access_token')

    if not access_token:
        return jsonify({'error': 'Missing access token'}), 400

    # 1. Validate token with Google
    is_valid, token_msg = validate_google_token(access_token)
    if not is_valid:
        return jsonify({'error': token_msg}), 400

    # 2. Fetch user profile from Google
    user_info = {}
    try:
        res = requests.get(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            headers={'Authorization': f'Bearer {access_token}'},
            timeout=10
        )
        if res.status_code == 200:
            user_info = res.json()
    except Exception as e:
        logger.warning(f"Failed to fetch Google userinfo: {e}")

    google_sub = user_info.get('sub') or session.get('user_id') or f"usr_{uuid.uuid4().hex[:16]}"
    name = user_info.get('name') or data.get('name') or 'YouTube Creator'
    email = user_info.get('email') or data.get('email')
    picture = user_info.get('picture') or data.get('picture')
    expires_in_secs = int(data.get('expires_in', 3600))
    token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in_secs)

    # 3. Optional: Fetch primary YouTube channel title
    channel_title = None
    try:
        yt_res = requests.get(
            'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
            headers={'Authorization': f'Bearer {access_token}'},
            timeout=10
        )
        if yt_res.status_code == 200:
            yt_data = yt_res.json()
            items = yt_data.get('items', [])
            if items:
                channel_title = items[0].get('snippet', {}).get('title')
    except Exception:
        pass

    # 4. Upsert User in database with encrypted token
    try:
        user = db.session.query(User).filter_by(id=google_sub).first()
        if not user:
            user = User(id=google_sub)
            db.session.add(user)

        user.name = name
        user.email = email
        user.picture = picture
        if channel_title:
            user.channel_title = channel_title
        user.set_access_token(access_token)
        if data.get('refresh_token'):
            user.set_refresh_token(data.get('refresh_token'))
        user.token_expires_at = token_expires_at
        user.updated_at = datetime.now(timezone.utc)

        db.session.commit()

        # 5. Link any previous anonymous session clips to the logged-in user
        previous_session_id = session.get('user_id')
        if previous_session_id and previous_session_id != user.id:
            try:
                db.session.query(Clip).filter_by(user_id=previous_session_id).update({'user_id': user.id})
                db.session.query(Job).filter_by(user_id=previous_session_id).update({'user_id': user.id})
                db.session.commit()
            except Exception as link_err:
                logger.warning(f"Note linking prior clips to user {user.id}: {link_err}")

        # 6. Set persistent signed session cookie
        session['user_id'] = user.id
        session.permanent = True

        return jsonify({
            'success': True,
            'user': user.to_dict(),
            'access_token': user.get_decrypted_access_token()
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error saving user login session to DB: {e}")
        return jsonify({'error': safe_error_message(e)}), 500


@app.route('/api/auth/logout', methods=['POST'])
@limiter.exempt
def auth_logout():
    """Clears user session from DB and resets cookie."""
    user_id = session.get('user_id')
    if user_id:
        try:
            user = db.session.query(User).filter_by(id=user_id).first()
            if user:
                user.access_token = None
                db.session.commit()
        except Exception as logout_err:
            db.session.rollback()
            logger.warning(f"DB error during logout for user {user_id}: {logout_err}")
    session.clear()
    return jsonify({'message': 'Logged out successfully'})


@app.route('/api/analyze', methods=['POST'])
@limiter.limit("10 per minute")
def analyze_video():
    """
    Analyzes YouTube video, sanitizes all inputs, and scopes created clips to current session user.
    """
    current_user_id = get_current_user_id()
    data = request.json or {}
    url = data.get('url')
    try:
        num_clips = int(data.get('num_clips', 3))
    except (ValueError, TypeError):
        num_clips = 3
    num_clips = max(1, min(num_clips, 10))

    if not url:
        return jsonify({'error': 'URL parameter is required.'}), 400

    video_id = extract_video_id(url)
    if not video_id:
        return jsonify({'error': 'Invalid or malformed YouTube URL provided.'}), 400

    try:
        metadata = get_video_metadata(video_id)
        duration_seconds = parse_duration(metadata['duration'])

        if duration_seconds <= 0:
            return jsonify({'error': 'Could not determine YouTube video duration.'}), 400

        if duration_seconds < 10.0:
            return jsonify({'error': f'Video duration ({int(duration_seconds)}s) is too short to extract 45-60s Short clips. Please select a video of at least 15 seconds.'}), 400

        if duration_seconds > 14400.0:  # 4 hours
            return jsonify({'error': 'Video exceeds the 4-hour limit for AI Shorts processing. Please choose a video under 4 hours.'}), 400

        transcript_raw = fetch_youtube_transcript(video_id)
        transcript_formatted = format_transcript_for_prompt(transcript_raw) if transcript_raw else None
        transcript_fallback = transcript_raw is None

        highlight_segments = analyze_transcript_highlights(
            video_id=video_id,
            transcript_formatted=transcript_formatted,
            duration_seconds=duration_seconds,
            title=metadata['title'],
            description=metadata['description'],
            num_clips=num_clips
        )

        clips_response = []

        for index, seg in enumerate(highlight_segments, start=1):
            s_sec = seg['start_seconds']
            e_sec = seg['end_seconds']
            start_ts = seconds_to_timestamp(s_sec)
            end_ts = seconds_to_timestamp(e_sec)

            snippet_text = ""
            if transcript_raw:
                snippet_lines = []
                for item in transcript_raw:
                    start_val = item.start if hasattr(item, 'start') else (item.get('start', 0) if isinstance(item, dict) else 0)
                    text_val = item.text if hasattr(item, 'text') else (item.get('text', '') if isinstance(item, dict) else '')
                    if s_sec <= start_val <= e_sec:
                        snippet_lines.append(str(text_val))
                snippet_text = " ".join(snippet_lines)[:1000]

            ai_meta = generate_ai_clip_metadata(
                original_title=metadata['title'],
                original_description=metadata['description'],
                transcript_snippet=snippet_text,
                start_timestamp=start_ts,
                end_timestamp=end_ts,
                clip_number=index
            )

            # Sanitize generated strings before persisting
            safe_title = sanitize_input_text(ai_meta['title'], max_length=100)
            safe_description = sanitize_input_text(ai_meta['description'], max_length=2000)
            safe_reasoning = sanitize_input_text(seg.get('reasoning', ''), max_length=500)

            new_clip = Clip(
                user_id=current_user_id,
                clip_id_num=index,
                video_id=video_id,
                video_url=url,
                start_time=start_ts,
                end_time=end_ts,
                start_seconds=s_sec,
                end_seconds=e_sec,
                title=safe_title,
                description=safe_description,
                suggested_tags=json.dumps(ai_meta['tags']),
                reasoning=safe_reasoning,
                privacy_status='public',
                status='analyzed',
                transcript_fallback=transcript_fallback or seg.get('transcript_fallback', False)
            )
            db.session.add(new_clip)
            db.session.flush()

            clip_dict = new_clip.to_dict()
            clips_response.append(clip_dict)

        db.session.commit()

        return jsonify({
            'metadata': metadata,
            'clips': clips_response
        })

    except Exception as e:
        db.session.rollback()
        logger.error(f"Analysis error for URL {url}: {e}", exc_info=True)
        return jsonify({'error': safe_error_message(e)}), 500


@app.route('/api/analyze-local', methods=['POST'])
@limiter.limit("10 per minute")
def analyze_local_video():
    """
    Accepts video file upload, sanitizes title and inputs, and scopes clips to session user.
    """
    current_user_id = get_current_user_id()

    if 'video' not in request.files:
        return jsonify({'error': 'No video file provided.'}), 400

    file = request.files['video']
    if not file or file.filename == '':
        return jsonify({'error': 'No file selected.'}), 400

    if not allowed_video_file(file.filename):
        allowed_exts = ', '.join(sorted(ALLOWED_VIDEO_EXTENSIONS))
        return jsonify({'error': f'Unsupported file type. Allowed: {allowed_exts}'}), 400

    try:
        num_clips = int(request.form.get('num_clips', 3))
    except (ValueError, TypeError):
        num_clips = 3
    num_clips = max(1, min(num_clips, 10))

    raw_custom_title = request.form.get('title', '').strip() or file.filename
    custom_title = sanitize_input_text(raw_custom_title, max_length=100)

    clips_folder = os.path.join(app.root_path, 'clips')
    os.makedirs(clips_folder, exist_ok=True)

    original_name = secure_filename(file.filename)
    unique_prefix = str(uuid.uuid4())[:8]
    saved_filename = f'upload_{unique_prefix}_{original_name}'
    saved_path = os.path.join(clips_folder, saved_filename)

    try:
        file.save(saved_path)
    except Exception as e:
        return jsonify({'error': f'Failed to save uploaded file: {str(e)}'}), 500

    try:
        duration_seconds = probe_local_video_duration(saved_path)
        if duration_seconds <= 0:
            return jsonify({'error': 'Could not determine video duration. Make sure FFmpeg is installed.'}), 500

        highlight_segments = analyze_transcript_highlights(
            video_id=unique_prefix,
            transcript_formatted=None,
            duration_seconds=duration_seconds,
            title=custom_title,
            description='',
            num_clips=num_clips
        )

        clips_response = []

        for index, seg in enumerate(highlight_segments, start=1):
            s_sec = seg['start_seconds']
            e_sec = seg['end_seconds']
            start_ts = seconds_to_timestamp(s_sec)
            end_ts = seconds_to_timestamp(e_sec)

            ai_meta = generate_ai_clip_metadata(
                original_title=custom_title,
                original_description='',
                transcript_snippet='',
                start_timestamp=start_ts,
                end_timestamp=end_ts,
                clip_number=index
            )

            safe_title = sanitize_input_text(ai_meta['title'], max_length=100)
            safe_description = sanitize_input_text(ai_meta['description'], max_length=2000)
            safe_reasoning = sanitize_input_text(seg.get('reasoning', ''), max_length=500)

            new_clip = Clip(
                user_id=current_user_id,
                clip_id_num=index,
                video_id=unique_prefix,
                video_url='local:' + saved_path,
                start_time=start_ts,
                end_time=end_ts,
                start_seconds=s_sec,
                end_seconds=e_sec,
                title=safe_title,
                description=safe_description,
                suggested_tags=json.dumps(ai_meta['tags']),
                reasoning=safe_reasoning,
                privacy_status='public',
                status='analyzed',
                transcript_fallback=True
            )
            db.session.add(new_clip)
            db.session.flush()

            clip_dict = new_clip.to_dict()
            clip_dict['local_source'] = True
            clip_dict['source_file'] = saved_path
            clips_response.append(clip_dict)

        db.session.commit()

        metadata = {
            'title': custom_title,
            'description': '',
            'thumbnail': '',
            'duration': f'PT{int(duration_seconds)}S',
            'video_id': unique_prefix,
            'local': True,
            'filename': original_name
        }

        return jsonify({'metadata': metadata, 'clips': clips_response})

    except Exception as e:
        db.session.rollback()
        if os.path.exists(saved_path):
            try:
                os.remove(saved_path)
            except OSError as rm_err:
                logger.warning(f"Could not remove failed upload file {saved_path}: {rm_err}")
        logger.error(f"Local video analysis error: {e}", exc_info=True)
        return jsonify({'error': safe_error_message(e)}), 500


@app.route('/api/upload', methods=['POST'])
@limiter.limit("10 per minute")
def start_upload():
    """
    Validates token custody and scopes the background upload job to the session user.
    """
    current_user_id = get_current_user_id()
    data = request.json or {}
    clips_data = data.get('clips', [])
    access_token = data.get('access_token')

    if not clips_data or not access_token:
        return jsonify({'error': 'Clips and YouTube access_token are required.'}), 400

    # Server-side token pre-validation
    is_valid_token, token_err = validate_google_token(access_token)
    if not is_valid_token:
        return jsonify({'error': token_err}), 400

    try:
        job_id = str(uuid.uuid4())
        new_job = Job(id=job_id, user_id=current_user_id, status='pending')
        db.session.add(new_job)

        for clip_item in clips_data:
            clip_id = clip_item.get('id')
            privacy = clip_item.get('privacyStatus', 'public')

            # Security Rationale: Prevent claiming or modifying clips belonging to other users or unassigned NULL sessions.
            db_clip = db.session.query(Clip).filter_by(id=clip_id).first()
            if db_clip:
                if not db_clip.user_id or db_clip.user_id != current_user_id:
                    continue  # Strict ownership: skip clips not owned by active session user

                db_clip.job_id = job_id
                db_clip.privacy_status = privacy if privacy in ['public', 'unlisted', 'private'] else 'public'
                if clip_item.get('title'):
                    db_clip.title = sanitize_input_text(str(clip_item.get('title')), max_length=100)
                if clip_item.get('description'):
                    db_clip.description = sanitize_input_text(str(clip_item.get('description')), max_length=2000)
                db_clip.status = 'pending'

        db.session.commit()

        if rq_queue:
            rq_queue.enqueue(process_job_task, job_id, access_token)
            logger.info(f"Job {job_id} enqueued to RQ Queue.")
        else:
            job_executor.submit(process_job_task, job_id, access_token)
            logger.info(f"Job {job_id} submitted to bounded ThreadPool.")

        return jsonify({'job_id': job_id})

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error starting upload job: {e}")
        return jsonify({'error': safe_error_message(e)}), 500


@app.route('/api/status/<job_id>')
@limiter.exempt
def get_job_status(job_id):
    """Query job & clips status scoped to session user."""
    current_user_id = get_current_user_id()
    job = db.session.query(Job).filter_by(id=job_id).first()
    if not job:
        return jsonify({'error': 'Job not found'}), 404

    # Security Rationale: Require strict ownership match. A job with user_id=None must NOT
    # be accessible across sessions to prevent cross-tenant job eavesdropping or authorization bypass.
    if not job.user_id or job.user_id != current_user_id:
        return jsonify({'error': 'Unauthorized: You do not have permission to view this job.'}), 403

    return jsonify(job.to_dict())


@app.route('/api/download/<int:clip_id>')
@limiter.exempt
def download_clip(clip_id):
    """
    User-scoped download endpoint with canonical extract_and_cut_segment.
    """
    current_user_id = get_current_user_id()
    clip = db.session.query(Clip).filter_by(id=clip_id).first()
    if not clip:
        return jsonify({'error': 'Clip record not found'}), 404

    # Security Rationale: Enforce strict ownership match. Disallow downloading clips where user_id is NULL or mismatched.
    if not clip.user_id or clip.user_id != current_user_id:
        return jsonify({'error': 'Unauthorized: You do not have permission to download this clip.'}), 403

    clips_folder = os.path.join(app.root_path, 'clips')
    os.makedirs(clips_folder, exist_ok=True)
    expected_path = os.path.join(clips_folder, f'clip_{clip.id}.mp4')

    if clip.file_path and os.path.exists(clip.file_path) and os.path.getsize(clip.file_path) > 0:
        return send_file(clip.file_path, as_attachment=True, download_name=f'clip_{clip.id}.mp4')

    # Cut on-demand using canonical video service helper
    try:
        extract_and_cut_segment(
            video_url=clip.video_url,
            clip_id=str(clip.id),
            start_seconds=clip.start_seconds,
            end_seconds=clip.end_seconds,
            clips_folder=clips_folder,
            output_clip_path=expected_path
        )

        clip.file_path = expected_path
        db.session.commit()

        return send_file(expected_path, as_attachment=True, download_name=f'clip_{clip.id}.mp4')
    except Exception as e:
        logger.error(f"Error generating download for clip {clip_id}: {e}")
        return jsonify({'error': f"Failed to prepare clip download: {str(e)}"}), 500


@app.route('/api/clip/<int:clip_id>/caption-style', methods=['PATCH'])
@limiter.exempt
def update_clip_caption_style(clip_id):
    """
    PATCH endpoint to update clip caption settings scoped to owner.
    """
    current_user_id = get_current_user_id()
    clip = db.session.query(Clip).filter_by(id=clip_id).first()
    if not clip:
        return jsonify({'error': 'Clip record not found'}), 404

    # Security Rationale: Disallow updating caption styles of clips where user_id is NULL or belongs to another user.
    if not clip.user_id or clip.user_id != current_user_id:
        return jsonify({'error': 'Unauthorized: You do not have permission to modify this clip.'}), 403

    data = request.get_json() or {}
    if 'caption_style' in data:
        clip.caption_style = sanitize_input_text(str(data['caption_style']), max_length=50)
    if 'caption_font' in data:
        clip.caption_font = sanitize_input_text(str(data['caption_font']), max_length=50)
    if 'caption_color' in data:
        clip.caption_color = sanitize_input_text(str(data['caption_color']), max_length=20)
    if 'caption_language' in data:
        clip.caption_language = sanitize_input_text(str(data['caption_language']), max_length=10)
    if 'has_captions' in data:
        clip.has_captions = bool(data['has_captions'])

    db.session.commit()

    # Re-render captions if video cut exists
    clips_folder = os.path.join(app.root_path, 'clips')
    expected_path = os.path.join(clips_folder, f'clip_{clip.id}.mp4')
    raw_path = os.path.join(clips_folder, f'raw_clip_{clip.id}.mp4')

    if os.path.exists(expected_path) or os.path.exists(raw_path):
        try:
            from services.caption_service import process_clip_captions
            source_for_captions = raw_path if os.path.exists(raw_path) else expected_path
            temp_output = os.path.join(clips_folder, f'recap_{clip.id}.mp4')
            duration = max(1.0, clip.end_seconds - clip.start_seconds)

            process_clip_captions(
                clip_video_path=source_for_captions,
                output_video_path=temp_output,
                fallback_transcript=clip.description,
                clip_duration=duration,
                caption_style=clip.caption_style,
                caption_font=clip.caption_font,
                caption_color=clip.caption_color,
                caption_language=clip.caption_language,
                temp_dir=clips_folder
            )

            if os.path.exists(expected_path):
                os.remove(expected_path)
            os.rename(temp_output, expected_path)
            clip.file_path = expected_path
            db.session.commit()
        except Exception as e:
            logger.error(f"Failed to re-render captions for clip {clip_id}: {e}")
            return jsonify({'warning': 'Updated DB settings, but re-render failed', 'error': str(e), 'clip': clip.to_dict()}), 200

    return jsonify({'message': 'Caption style updated successfully', 'clip': clip.to_dict()})


@app.route('/api/clip/<int:clip_id>', methods=['DELETE'])
@limiter.exempt
def delete_clip(clip_id):
    """
    Deletes a clip record and its rendered video files, strictly scoped to the owning user.
    """
    current_user_id = get_current_user_id()
    clip = db.session.query(Clip).filter_by(id=clip_id).first()
    if not clip:
        return jsonify({'error': 'Clip not found'}), 404

    # Security Rationale: Enforce strict ownership. Never allow deletion of clips with NULL user_id or mismatched user_id.
    if not clip.user_id or clip.user_id != current_user_id:
        return jsonify({'error': 'Unauthorized: You do not have permission to delete this clip.'}), 403

    try:
        clips_folder = os.path.join(app.root_path, 'clips')
        file_candidates = [
            clip.file_path,
            os.path.join(clips_folder, f'clip_{clip.id}.mp4'),
            os.path.join(clips_folder, f'raw_clip_{clip.id}.mp4'),
            os.path.join(clips_folder, f'seg_{clip.id}.mp4')
        ]
        for f in file_candidates:
            if f and os.path.exists(f):
                try:
                    os.remove(f)
                except Exception:
                    pass

        db.session.delete(clip)
        db.session.commit()
        return jsonify({'success': True, 'message': f'Clip {clip_id} deleted successfully.'})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting clip {clip_id}: {e}")
        return jsonify({'error': safe_error_message(e)}), 500


@app.route('/clips/<path:filename>')
def serve_clip_file(filename):
    """Serve generated clip video files for preview.

    Security: Enforces strict ownership before serving any clip file.
    Filenames follow the pattern clip_<id>.mp4 / raw_clip_<id>.mp4.
    Without this check any client can enumerate sequential IDs and download
    other users' clips (IDOR).
    """
    current_user_id = get_current_user_id()
    clips_folder = os.path.join(app.root_path, 'clips')

    # Extract numeric clip ID from the filename (supports clip_N.mp4, raw_clip_N.mp4, etc.)
    id_match = re.search(r'(?:^|_)(\d+)\.mp4$', filename)
    if id_match:
        clip_db_id = int(id_match.group(1))
        clip = db.session.query(Clip).filter_by(id=clip_db_id).first()
        if not clip or not clip.user_id or clip.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized: You do not have permission to access this file.'}), 403

    return send_from_directory(clips_folder, filename)


@app.route('/api/projects', methods=['GET'])
@limiter.exempt
def get_projects():
    """
    Retrieve list of recent clips and projects strictly scoped to the session user.
    """
    current_user_id = get_current_user_id()
    try:
        # Security Rationale: Strictly filter by active session user_id to prevent leaking NULL/anonymous
        # clips or jobs created by other users across the application.
        query = db.session.query(Clip).filter(Clip.user_id == current_user_id)
        clips = query.order_by(Clip.created_at.desc()).limit(50).all()

        total_clips = query.count()
        completed_clips = query.filter_by(status='completed').count()

        jobs_count = db.session.query(Job).filter(Job.user_id == current_user_id).count()

        clips_list = [c.to_dict() for c in clips]
        return jsonify({
            'clips': clips_list,
            'stats': {
                'total_clips': total_clips,
                'completed_clips': completed_clips,
                'total_projects': jobs_count
            }
        })
    except Exception as e:
        logger.error(f"Error fetching projects: {e}")
        return jsonify({'error': str(e), 'clips': [], 'stats': {'total_clips': 0, 'completed_clips': 0, 'total_projects': 0}}), 500


@app.route('/api/admin/cleanup', methods=['POST'])
@limiter.limit("20 per minute")
def trigger_cleanup():
    """
    Protected Admin endpoint to clean up DB records and clip files older than 24 hours.
    Requires X-Admin-Key header matching ADMIN_API_KEY environment variable.
    """
    admin_key = os.getenv('ADMIN_API_KEY')
    provided_key = (
        request.headers.get('X-Admin-Key') or
        request.headers.get('Authorization', '').replace('Bearer ', '').strip() or
        request.args.get('key')
    )

    # Security Rationale: Constant-time comparison prevents timing attacks on admin authentication.
    # We safely check that both keys are non-empty strings before calling hmac.compare_digest.
    if (
        not admin_key or
        not provided_key or
        not isinstance(provided_key, str) or
        not isinstance(admin_key, str) or
        not hmac.compare_digest(provided_key.strip().encode('utf-8'), admin_key.strip().encode('utf-8'))
    ):
        logger.warning(f"Unauthorized cleanup attempt from IP {get_remote_address()}")
        return jsonify({'error': 'Forbidden: Valid X-Admin-Key required for administrative cleanup.'}), 403

    try:
        clips_folder = os.path.join(app.root_path, 'clips')
        cleanup_old_data(db.session, clips_folder, hours=24)
        return jsonify({'message': '24-hour cleanup executed successfully.'})
    except Exception as e:
        logger.error(f"Admin cleanup error: {e}", exc_info=True)
        return jsonify({'error': safe_error_message(e)}), 500


# ==============================================================================
# Scheduled Auto-Publishing & Channel Discovery Endpoints
# ==============================================================================

@app.route('/api/source-channels/curated', methods=['GET'])
@limiter.exempt
def get_curated_channels():
    """
    Returns the curated collection of 98+ top verified creator and educational channels.
    """
    from services.discovery_service import load_curated_channels
    channels = load_curated_channels()
    return jsonify({'channels': channels, 'total': len(channels)})


@app.route('/api/source-channels/discover', methods=['GET'])
@limiter.limit("30 per minute")
def discover_channels():
    """
    Discovers Creative Commons YouTube channels based on search query or topics.
    """
    query = request.args.get('query', 'technology podcast')
    try:
        channels = discover_creative_commons_channels(query=query, max_results=20)
        return jsonify({'channels': channels, 'query': query})
    except Exception as e:
        logger.error(f"Error discovering channels: {e}")
        return jsonify({'error': str(e), 'channels': []}), 500


@app.route('/api/source-channels', methods=['GET'])
@limiter.exempt
def list_source_channels():
    """
    List all channels tracked by the authenticated user.
    Auto-populates popular defaults if user has none.
    """
    current_user_id = get_current_user_id()
    channels = db.session.query(SourceChannel).filter_by(added_by_user_id=current_user_id, is_active=True).order_by(SourceChannel.created_at.desc()).all()

    # If new user has 0 channels, auto-seed with curated channels
    if not channels:
        from services.discovery_service import load_curated_channels
        curated = load_curated_channels()
        if curated:
            for item in curated[:20]:
                db.session.add(SourceChannel(
                    channel_id=item['channel_id'],
                    channel_title=item['channel_title'],
                    channel_thumbnail=item.get('channel_thumbnail', ''),
                    subscriber_count=item.get('subscriber_count', 'Creator'),
                    video_count=item.get('video_count', 'N/A'),
                    added_by_user_id=current_user_id,
                    license_filter='all',
                    is_active=True
                ))
            db.session.commit()
            channels = db.session.query(SourceChannel).filter_by(added_by_user_id=current_user_id, is_active=True).order_by(SourceChannel.created_at.desc()).all()

    return jsonify({'channels': [c.to_dict() for c in channels]})


@app.route('/api/source-channels/batch', methods=['POST'])
@limiter.limit("30 per minute")
def batch_add_source_channels():
    """
    Batch tracks multiple curated channels for the authenticated user.
    """
    current_user_id = get_current_user_id()
    data = request.json or {}
    channel_list = data.get('channels', [])
    if not isinstance(channel_list, list):
        return jsonify({'error': 'channels must be a list.'}), 400

    added_count = 0
    try:
        for c in channel_list:
            c_id = sanitize_input_text(str(c.get('channel_id', '')), max_length=100)
            c_title = sanitize_input_text(str(c.get('channel_title', '')), max_length=255)
            if not c_id or not c_title:
                continue

            existing = db.session.query(SourceChannel).filter_by(
                channel_id=c_id,
                added_by_user_id=current_user_id
            ).first()

            if existing:
                existing.is_active = True
                existing.channel_title = c_title
            else:
                new_chan = SourceChannel(
                    channel_id=c_id,
                    channel_title=c_title,
                    channel_thumbnail=str(c.get('channel_thumbnail', '')),
                    subscriber_count=str(c.get('subscriber_count', 'Creator')),
                    video_count=str(c.get('video_count', 'N/A')),
                    added_by_user_id=current_user_id,
                    license_filter='all',
                    is_active=True
                )
                db.session.add(new_chan)
                added_count += 1

        db.session.commit()
        return jsonify({'success': True, 'added_count': added_count, 'message': f'Successfully tracked {added_count} channels.'})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error batch tracking channels: {e}")
        return jsonify({'error': safe_error_message(e)}), 500


@app.route('/api/source-channels', methods=['POST'])
@limiter.limit("20 per minute")
def add_source_channel():
    """
    Adds a verified Creative Commons channel to the user's tracked channels.
    """
    current_user_id = get_current_user_id()
    data = request.json or {}
    channel_id = sanitize_input_text(str(data.get('channel_id', '')), max_length=100)
    channel_title = sanitize_input_text(str(data.get('channel_title', '')), max_length=255)

    if not channel_id or not channel_title:
        return jsonify({'error': 'channel_id and channel_title are required.'}), 400

    try:
        # Check if already added
        existing = db.session.query(SourceChannel).filter_by(
            channel_id=channel_id,
            added_by_user_id=current_user_id
        ).first()

        if existing:
            existing.is_active = True
            existing.channel_title = channel_title
            if data.get('channel_thumbnail'):
                existing.channel_thumbnail = str(data.get('channel_thumbnail'))
            if data.get('subscriber_count'):
                existing.subscriber_count = str(data.get('subscriber_count'))
            db.session.commit()
            return jsonify({'success': True, 'channel': existing.to_dict(), 'message': 'Channel updated in tracking.'})

        new_channel = SourceChannel(
            channel_id=channel_id,
            channel_title=channel_title,
            channel_thumbnail=str(data.get('channel_thumbnail', '')),
            subscriber_count=str(data.get('subscriber_count', 'N/A')),
            video_count=str(data.get('video_count', 'N/A')),
            added_by_user_id=current_user_id,
            is_active=True
        )
        db.session.add(new_channel)
        db.session.commit()
        return jsonify({'success': True, 'channel': new_channel.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error adding source channel: {e}")
        return jsonify({'error': safe_error_message(e)}), 500


@app.route('/api/source-channels/<int:channel_id>', methods=['DELETE'])
@limiter.exempt
def remove_source_channel(channel_id):
    """
    Removes a tracked source channel scoped to the owner.
    """
    current_user_id = get_current_user_id()
    channel = db.session.query(SourceChannel).filter_by(id=channel_id, added_by_user_id=current_user_id).first()
    if not channel:
        return jsonify({'error': 'Tracked channel not found or unauthorized.'}), 404

    try:
        db.session.delete(channel)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Source channel removed from tracking.'})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting source channel: {e}")
        return jsonify({'error': safe_error_message(e)}), 500


@app.route('/api/schedule-rules', methods=['GET'])
@limiter.exempt
def list_schedule_rules():
    """
    Retrieves all schedule rules belonging to the authenticated user.
    """
    current_user_id = get_current_user_id()
    rules = db.session.query(ScheduleRule).filter_by(user_id=current_user_id).order_by(ScheduleRule.created_at.desc()).all()
    return jsonify({'rules': [r.to_dict() for r in rules]})


@app.route('/api/schedule-rules', methods=['POST'])
@limiter.limit("20 per minute")
def create_schedule_rule():
    """
    Creates a new schedule rule and automatically registers it with APScheduler.
    """
    current_user_id = get_current_user_id()
    data = request.json or {}
    name = sanitize_input_text(str(data.get('name', 'Auto-Publish Rule')), max_length=200)

    VALID_CAPTION_STYLES = {'tiktok_pop', 'bounce', 'minimal', 'bold', 'karaoke'}
    try:
        new_rule = ScheduleRule(
            user_id=current_user_id,
            name=name,
            frequency=data.get('frequency', 'daily') if data.get('frequency') in ['daily', 'hourly', 'weekly', 'once'] else 'daily',
            run_at_time=validate_run_at_time(str(data.get('run_at_time', '14:00'))),
            num_clips_per_video=min(max(int(data.get('num_clips_per_video', 3)), 1), 5),
            max_videos_per_run=min(max(int(data.get('max_videos_per_run', 1)), 1), 3),
            caption_style=sanitize_input_text(str(data.get('caption_style', 'tiktok_pop')), max_length=50),
            caption_font=sanitize_input_text(str(data.get('caption_font', 'Arial Black')), max_length=100),
            caption_color=sanitize_input_text(str(data.get('caption_color', '#FFFF00')), max_length=20),
            privacy_status=data.get('privacy_status', 'public') if data.get('privacy_status') in ['public', 'unlisted', 'private'] else 'public',
            is_active=bool(data.get('is_active', True))
        )
        new_rule.set_source_channel_ids(data.get('source_channel_ids', []))

        db.session.add(new_rule)
        db.session.commit()

        # Register live with APScheduler
        schedule_job_for_rule(new_rule.id)

        return jsonify({'success': True, 'rule': new_rule.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating schedule rule: {e}")
        return jsonify({'error': safe_error_message(e)}), 500


@app.route('/api/schedule-rules/<int:rule_id>', methods=['PATCH'])
@limiter.exempt
def update_schedule_rule(rule_id):
    """
    Updates an existing schedule rule and reschedules the APScheduler job.
    """
    current_user_id = get_current_user_id()
    rule = db.session.query(ScheduleRule).filter_by(id=rule_id, user_id=current_user_id).first()
    if not rule:
        return jsonify({'error': 'Schedule rule not found or unauthorized.'}), 404

    data = request.json or {}
    if 'name' in data:
        rule.name = sanitize_input_text(str(data['name']), max_length=200)
    if 'frequency' in data and data['frequency'] in ['daily', 'hourly', 'weekly', 'once']:
        rule.frequency = data['frequency']
    if 'run_at_time' in data:
        # Validate HH:MM format before persisting to prevent injection into cron strings
        rule.run_at_time = validate_run_at_time(str(data['run_at_time']))
    if 'num_clips_per_video' in data:
        rule.num_clips_per_video = min(max(int(data['num_clips_per_video']), 1), 5)
    if 'max_videos_per_run' in data:
        rule.max_videos_per_run = min(max(int(data['max_videos_per_run']), 1), 3)
    if 'caption_style' in data:
        rule.caption_style = sanitize_input_text(str(data['caption_style']), max_length=50)
    if 'caption_font' in data:
        rule.caption_font = sanitize_input_text(str(data['caption_font']), max_length=100)
    if 'caption_color' in data:
        rule.caption_color = sanitize_input_text(str(data['caption_color']), max_length=20)
    if 'privacy_status' in data and data['privacy_status'] in ['public', 'unlisted', 'private']:
        rule.privacy_status = data['privacy_status']
    if 'is_active' in data:
        rule.is_active = bool(data['is_active'])
    if 'source_channel_ids' in data:
        rule.set_source_channel_ids(data['source_channel_ids'])

    db.session.commit()

    # Re-sync with APScheduler
    if rule.is_active:
        schedule_job_for_rule(rule.id)
    else:
        remove_scheduled_job(rule.id)

    return jsonify({'success': True, 'rule': rule.to_dict()})


@app.route('/api/schedule-rules/<int:rule_id>', methods=['DELETE'])
@limiter.exempt
def delete_schedule_rule(rule_id):
    """
    Deletes a schedule rule and removes its APScheduler job.
    """
    current_user_id = get_current_user_id()
    rule = db.session.query(ScheduleRule).filter_by(id=rule_id, user_id=current_user_id).first()
    if not rule:
        return jsonify({'error': 'Schedule rule not found or unauthorized.'}), 404

    try:
        remove_scheduled_job(rule_id)
        db.session.delete(rule)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Schedule rule deleted successfully.'})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting schedule rule: {e}")
        return jsonify({'error': safe_error_message(e)}), 500


@app.route('/api/schedule-rules/<int:rule_id>/run-now', methods=['POST'])
@limiter.limit("5 per minute")
def run_schedule_rule_now(rule_id):
    """
    Manually triggers an immediate execution of a schedule rule in the background worker pool.
    """
    current_user_id = get_current_user_id()
    rule = db.session.query(ScheduleRule).filter_by(id=rule_id, user_id=current_user_id).first()
    if not rule:
        return jsonify({'error': 'Schedule rule not found or unauthorized.'}), 404

    # Run asynchronously in background executor
    job_executor.submit(execute_schedule_rule, rule.id)
    logger.info(f"Triggered manual run for schedule rule #{rule.id} ('{rule.name}')")

    return jsonify({
        'success': True,
        'message': f"Automated pipeline started for '{rule.name}'. Check run history in a few moments."
    })


@app.route('/api/schedule-rules/<int:rule_id>/runs', methods=['GET'])
@limiter.exempt
def get_schedule_rule_runs(rule_id):
    """
    Retrieves audit execution history for a schedule rule.
    """
    current_user_id = get_current_user_id()
    rule = db.session.query(ScheduleRule).filter_by(id=rule_id, user_id=current_user_id).first()
    if not rule:
        return jsonify({'error': 'Schedule rule not found or unauthorized.'}), 404

    runs = db.session.query(ScheduledJobRun).filter_by(schedule_rule_id=rule_id).order_by(ScheduledJobRun.triggered_at.desc()).limit(30).all()
    return jsonify({'runs': [r.to_dict() for r in runs]})


# ==============================================================================
# Master Scheduler Control Endpoints
# ==============================================================================

@app.route('/api/scheduler/status', methods=['GET'])
@limiter.exempt
def get_scheduler_daemon_status():
    """
    Returns live operational status of the APScheduler background daemon.
    """
    from services.scheduler_service import get_scheduler_info
    return jsonify(get_scheduler_info())


@app.route('/api/scheduler/start', methods=['POST'])
@limiter.exempt
def start_scheduler_daemon():
    """
    Starts or resumes the APScheduler daemon and resynchronizes active schedule rules.
    """
    from services.scheduler_service import resume_scheduler, sync_all_active_rules
    resume_scheduler()
    sync_all_active_rules()
    return jsonify({'success': True, 'message': 'Auto-Pilot Scheduler started & active.'})


@app.route('/api/scheduler/pause', methods=['POST'])
@limiter.exempt
def pause_scheduler_daemon():
    """
    Pauses the APScheduler daemon from firing automated cron triggers.
    """
    from services.scheduler_service import pause_scheduler
    pause_scheduler()
    return jsonify({'success': True, 'message': 'Auto-Pilot Scheduler paused.'})


@app.route('/api/scheduler/trigger-all', methods=['POST'])
@limiter.limit("5 per minute")
def trigger_all_scheduled_rules():
    """
    Triggers an immediate background execution across all active schedule rules for this user.
    """
    current_user_id = get_current_user_id()
    rules = db.session.query(ScheduleRule).filter_by(user_id=current_user_id, is_active=True).all()
    if not rules:
        return jsonify({'error': 'No active schedule rules found to trigger.'}), 400

    from services.scheduler_service import execute_schedule_rule
    for r in rules:
        job_executor.submit(execute_schedule_rule, r.id)

    return jsonify({
        'success': True,
        'message': f"Started immediate background execution for {len(rules)} schedule rule(s)."
    })


if __name__ == '__main__':
    flask_env = os.getenv('FLASK_ENV', 'development')
    debug_mode = os.getenv('FLASK_DEBUG', '0').lower() in ['1', 'true', 'yes']
    port = int(os.getenv('FLASK_PORT', 5000))
    host = os.getenv('FLASK_HOST', '127.0.0.1')

    # Debug safety check: Never run debug mode in production environment
    if flask_env == 'production' and debug_mode:
        raise RuntimeError("CRITICAL PRODUCTION VIOLATION: FLASK_DEBUG cannot be enabled when FLASK_ENV=production.")

    logger.info(f"Starting ClipFlow AI Flask server on {host}:{port} (Env: {flask_env}, Debug: {debug_mode})")
    app.run(host=host, port=port, debug=debug_mode)