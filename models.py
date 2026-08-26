from datetime import datetime, timedelta, timezone
import json
import logging
import os
import base64
import hashlib
from flask_sqlalchemy import SQLAlchemy

from sqlalchemy import inspect, text, event
from sqlalchemy.engine import Engine
from cryptography.fernet import Fernet, InvalidToken

db = SQLAlchemy()
logger = logging.getLogger(__name__)



def _get_fernet_cipher() -> Fernet:
    """
    Retrieves or derives a 32-byte URL-safe Fernet cipher instance from ENCRYPTION_KEY.
    """
    key = os.getenv('ENCRYPTION_KEY')
    if key and key.strip():
        try:
            return Fernet(key.strip().encode('utf-8'))
        except Exception:
            derived = base64.urlsafe_b64encode(hashlib.sha256(key.strip().encode('utf-8')).digest())
            return Fernet(derived)

    # Fallback to deriving from SECRET_KEY
    fallback_secret = os.getenv('SECRET_KEY', 'clipai_ephemeral_dev_encryption_secret_key')
    derived = base64.urlsafe_b64encode(hashlib.sha256(fallback_secret.encode('utf-8')).digest())
    return Fernet(derived)


def encrypt_token(raw_token: str) -> str:
    """Encrypts plaintext OAuth token using symmetric Fernet encryption."""
    if not raw_token or not isinstance(raw_token, str):
        return ""
    cipher = _get_fernet_cipher()
    encrypted_bytes = cipher.encrypt(raw_token.strip().encode('utf-8'))
    return "enc:" + encrypted_bytes.decode('utf-8')


def decrypt_token(stored_token: str) -> str:
    """
    Decrypts encrypted OAuth token.
    Gracefully falls back for legacy plaintext rows for seamless migrations.
    """
    if not stored_token or not isinstance(stored_token, str):
        return ""
    if not stored_token.startswith("enc:"):
        # Backwards compatibility: token was stored in plaintext prior to encryption
        return stored_token
    cipher_text = stored_token[len("enc:"):]
    cipher = _get_fernet_cipher()
    try:
        decrypted_bytes = cipher.decrypt(cipher_text.encode('utf-8'))
        return decrypted_bytes.decode('utf-8')
    except (InvalidToken, Exception):
        return stored_token


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Enable Write-Ahead Logging and 5000ms busy timeout on SQLite to prevent database locks."""
    try:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()
    except Exception as pragma_err:
        logger.debug(f"SQLite PRAGMA setup note (non-fatal): {pragma_err}")



def auto_migrate_schema(engine):
    """
    Ensures existing database tables are updated with newly added columns
    without requiring manual database deletion or complex migrations.
    """
    try:
        inspector = inspect(engine)
        table_names = inspector.get_table_names()

        if 'users' in table_names:
            user_columns = [c['name'] for c in inspector.get_columns('users')]
            if 'refresh_token' not in user_columns:
                with engine.connect() as conn:
                    conn.execute(text("ALTER TABLE users ADD COLUMN refresh_token TEXT DEFAULT NULL"))
                    conn.commit()

        if 'clips' in table_names:
            columns = [c['name'] for c in inspector.get_columns('clips')]

            migrations = [
                ('has_captions', 'BOOLEAN DEFAULT 1'),
                ('caption_style', "VARCHAR(50) DEFAULT 'tiktok_pop'"),
                ('caption_font', "VARCHAR(100) DEFAULT 'Arial Black'"),
                ('caption_color', "VARCHAR(20) DEFAULT '#FFFF00'"),
                ('caption_language', "VARCHAR(10) DEFAULT 'auto'"),
                ('user_id', "VARCHAR(100) DEFAULT NULL")
            ]

            with engine.connect() as conn:
                for col_name, col_type in migrations:
                    if col_name not in columns:
                        conn.execute(text(f"ALTER TABLE clips ADD COLUMN {col_name} {col_type}"))
                conn.commit()

        if 'jobs' in table_names:
            job_columns = [c['name'] for c in inspector.get_columns('jobs')]
            if 'user_id' not in job_columns:
                with engine.connect() as conn:
                    conn.execute(text("ALTER TABLE jobs ADD COLUMN user_id VARCHAR(100) DEFAULT NULL"))
                    conn.commit()

    except Exception as e:
        print(f"Database auto-migration note: {e}")


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.String(100), primary_key=True)  # Google Sub / User ID
    email = db.Column(db.String(255), nullable=True)
    name = db.Column(db.String(255), nullable=True)
    picture = db.Column(db.String(500), nullable=True)
    channel_title = db.Column(db.String(255), nullable=True)
    access_token = db.Column(db.Text, nullable=True)  # Encrypted at rest
    refresh_token = db.Column(db.Text, nullable=True)  # Encrypted at rest
    token_expires_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    source_channels = db.relationship('SourceChannel', backref='user', lazy=True, cascade="all, delete-orphan")
    schedule_rules = db.relationship('ScheduleRule', backref='user', lazy=True, cascade="all, delete-orphan")

    def set_access_token(self, raw_token: str):
        """Encrypts OAuth access token before persistence."""
        self.access_token = encrypt_token(raw_token)

    def get_decrypted_access_token(self) -> str:
        """Decrypts OAuth access token for API usage."""
        return decrypt_token(self.access_token)

    def set_refresh_token(self, raw_token: str):
        """Encrypts OAuth refresh token before persistence."""
        self.refresh_token = encrypt_token(raw_token)

    def get_decrypted_refresh_token(self) -> str:
        """Decrypts OAuth refresh token for unattended token renewal."""
        return decrypt_token(self.refresh_token)

    def to_dict(self):
        now_utc = datetime.now(timezone.utc)
        has_token = bool(self.access_token)
        has_refresh = bool(self.refresh_token)
        is_expired = False
        if self.token_expires_at:
            exp = self.token_expires_at.replace(tzinfo=timezone.utc) if self.token_expires_at.tzinfo is None else self.token_expires_at
            is_expired = exp < now_utc

        return {
            'id': self.id,
            'email': self.email,
            'name': self.name or 'YouTube Creator',
            'picture': self.picture,
            'channel_title': self.channel_title,
            'is_authenticated': True,
            'has_valid_token': has_token and not is_expired,
            'has_refresh_token': has_refresh
        }


class SourceChannel(db.Model):
    __tablename__ = 'source_channels'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    channel_id = db.Column(db.String(100), nullable=False, index=True)  # YouTube Channel ID (UC...)
    channel_title = db.Column(db.String(255), nullable=False)
    channel_thumbnail = db.Column(db.String(500), nullable=True)
    subscriber_count = db.Column(db.String(50), nullable=True)
    video_count = db.Column(db.String(50), nullable=True)
    added_by_user_id = db.Column(db.String(100), db.ForeignKey('users.id'), nullable=False, index=True)
    license_filter = db.Column(db.String(50), default='creativeCommon')
    is_active = db.Column(db.Boolean, default=True)
    last_checked_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    processed_videos = db.relationship('ProcessedSourceVideo', backref='source_channel', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'channel_id': self.channel_id,
            'channel_title': self.channel_title,
            'channel_thumbnail': self.channel_thumbnail,
            'subscriber_count': self.subscriber_count,
            'video_count': self.video_count,
            'added_by_user_id': self.added_by_user_id,
            'license_filter': self.license_filter,
            'is_active': self.is_active,
            'last_checked_at': self.last_checked_at.isoformat() if self.last_checked_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class ScheduleRule(db.Model):
    __tablename__ = 'schedule_rules'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.String(100), db.ForeignKey('users.id'), nullable=False, index=True)
    name = db.Column(db.String(200), nullable=False)
    source_channel_ids = db.Column(db.Text, default='[]')  # JSON list of SourceChannel.id
    frequency = db.Column(db.String(50), default='daily')  # 'daily', 'hourly', 'weekly', 'once'
    run_at_time = db.Column(db.String(10), default='14:00')  # 24h format "HH:MM"
    num_clips_per_video = db.Column(db.Integer, default=3)
    max_videos_per_run = db.Column(db.Integer, default=1)
    caption_style = db.Column(db.String(50), default='tiktok_pop')
    caption_font = db.Column(db.String(100), default='Arial Black')
    caption_color = db.Column(db.String(20), default='#FFFF00')
    privacy_status = db.Column(db.String(20), default='public')  # 'public', 'unlisted', 'private'
    is_active = db.Column(db.Boolean, default=True)
    last_run_at = db.Column(db.DateTime, nullable=True)
    next_run_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    runs = db.relationship('ScheduledJobRun', backref='schedule_rule', lazy=True, cascade='all, delete-orphan')

    def get_source_channel_ids(self):
        if self.source_channel_ids:
            try:
                return json.loads(self.source_channel_ids)
            except Exception:
                return []
        return []

    def set_source_channel_ids(self, ids_list):
        self.source_channel_ids = json.dumps(ids_list if isinstance(ids_list, list) else [])

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'source_channel_ids': self.get_source_channel_ids(),
            'frequency': self.frequency,
            'run_at_time': self.run_at_time,
            'num_clips_per_video': self.num_clips_per_video,
            'max_videos_per_run': self.max_videos_per_run,
            'caption_style': self.caption_style,
            'caption_font': self.caption_font,
            'caption_color': self.caption_color,
            'privacy_status': self.privacy_status,
            'is_active': self.is_active,
            'last_run_at': self.last_run_at.isoformat() if self.last_run_at else None,
            'next_run_at': self.next_run_at.isoformat() if self.next_run_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class ScheduledJobRun(db.Model):
    __tablename__ = 'scheduled_job_runs'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    schedule_rule_id = db.Column(db.Integer, db.ForeignKey('schedule_rules.id'), nullable=False, index=True)
    triggered_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(50), default='running')  # 'running', 'completed', 'failed', 'skipped'
    source_videos_processed = db.Column(db.Text, default='[]')  # JSON list of video metadata & shorts URLs
    error_message = db.Column(db.Text, nullable=True)

    def get_source_videos_processed(self):
        if self.source_videos_processed:
            try:
                return json.loads(self.source_videos_processed)
            except Exception:
                return []
        return []

    def set_source_videos_processed(self, items):
        self.source_videos_processed = json.dumps(items if isinstance(items, list) else [])

    def to_dict(self):
        return {
            'id': self.id,
            'schedule_rule_id': self.schedule_rule_id,
            'triggered_at': self.triggered_at.isoformat() if self.triggered_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'status': self.status,
            'source_videos_processed': self.get_source_videos_processed(),
            'error_message': self.error_message
        }


class ProcessedSourceVideo(db.Model):
    __tablename__ = 'processed_source_videos'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    source_channel_id = db.Column(db.Integer, db.ForeignKey('source_channels.id'), nullable=True, index=True)
    youtube_video_id = db.Column(db.String(50), nullable=False, index=True)
    video_title = db.Column(db.String(255), nullable=True)
    processed_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'source_channel_id': self.source_channel_id,
            'youtube_video_id': self.youtube_video_id,
            'video_title': self.video_title,
            'processed_at': self.processed_at.isoformat() if self.processed_at else None
        }


class Job(db.Model):
    __tablename__ = 'jobs'

    id = db.Column(db.String(36), primary_key=True)
    user_id = db.Column(db.String(100), nullable=True, index=True)
    status = db.Column(db.String(20), default='pending')  # pending, processing, completed, failed
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    error_message = db.Column(db.Text, nullable=True)

    clips = db.relationship('Clip', backref='job', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'error_message': self.error_message,
            'clips': [clip.to_dict() for clip in self.clips]
        }


class Clip(db.Model):
    __tablename__ = 'clips'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.String(100), nullable=True, index=True)
    job_id = db.Column(db.String(36), db.ForeignKey('jobs.id'), nullable=True)
    clip_id_num = db.Column(db.Integer, nullable=False)
    video_id = db.Column(db.String(50), nullable=False)
    video_url = db.Column(db.String(500), nullable=False)
    start_time = db.Column(db.String(20), nullable=False)
    end_time = db.Column(db.String(20), nullable=False)
    start_seconds = db.Column(db.Float, nullable=False)
    end_seconds = db.Column(db.Float, nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    suggested_tags = db.Column(db.Text, nullable=True)  # JSON string
    reasoning = db.Column(db.Text, nullable=True)
    file_path = db.Column(db.String(500), nullable=True)
    youtube_url = db.Column(db.String(500), nullable=True)
    privacy_status = db.Column(db.String(20), default='public')  # public, unlisted, private
    status = db.Column(db.String(20), default='analyzed')  # analyzed, pending, downloading, processing, uploading, completed, failed
    error_message = db.Column(db.Text, nullable=True)
    transcript_fallback = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Kinetic Subtitles Customization Schema
    has_captions = db.Column(db.Boolean, default=True)
    caption_style = db.Column(db.String(50), default='tiktok_pop')
    caption_font = db.Column(db.String(100), default='Arial Black')
    caption_color = db.Column(db.String(20), default='#FFFF00')
    caption_language = db.Column(db.String(10), default='auto')

    def get_tags(self):
        if self.suggested_tags:
            try:
                return json.loads(self.suggested_tags)
            except Exception:
                return []
        return []

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'clip_id_num': self.clip_id_num,
            'video_id': self.video_id,
            'video_url': self.video_url,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'start_seconds': self.start_seconds,
            'end_seconds': self.end_seconds,
            'duration': round(self.end_seconds - self.start_seconds, 2),
            'title': self.title,
            'description': self.description,
            'tags': self.get_tags(),
            'reasoning': self.reasoning,
            'youtube_url': self.youtube_url,
            'privacy_status': self.privacy_status,
            'status': self.status,
            'error_message': self.error_message,
            'transcript_fallback': self.transcript_fallback,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'has_captions': self.has_captions,
            'caption_style': self.caption_style,
            'caption_font': self.caption_font,
            'caption_color': self.caption_color,
            'caption_language': self.caption_language,
            # Boolean flag only — never expose raw server-side filesystem paths
            'has_local_file': bool(self.file_path and os.path.exists(self.file_path)),
            'local_source': bool(self.video_url and self.video_url.startswith('local:')),
        }



def cleanup_old_data(session, clips_folder: str, hours: int = 24):
    """
    Deletes Job and Clip records older than `hours` hours and removes their
    associated video files from disk to prevent storage exhaustion.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

    # Active statuses: skip clips still mid-pipeline to avoid deleting files under active use
    ACTIVE_STATUSES = ('processing', 'downloading', 'uploading', 'pending')

    try:
        old_clips = session.query(Clip).filter(
            Clip.created_at < cutoff,
            Clip.status.notin_(ACTIVE_STATUSES)
        ).all()

        for clip in old_clips:
            if clip.file_path and os.path.exists(clip.file_path):
                try:
                    os.remove(clip.file_path)
                except Exception:
                    pass
            session.delete(clip)

        old_jobs = session.query(Job).filter(Job.created_at < cutoff).all()
        for job in old_jobs:
            session.delete(job)

        session.commit()

        if os.path.exists(clips_folder):
            now_ts = datetime.now().timestamp()
            cutoff_ts = now_ts - (hours * 3600)
            for fname in os.listdir(clips_folder):
                fpath = os.path.join(clips_folder, fname)
                if os.path.isfile(fpath) and os.path.getmtime(fpath) < cutoff_ts:
                    try:
                        os.remove(fpath)
                    except Exception:
                        pass

    except Exception as e:
        session.rollback()
        print(f"Error during cleanup: {e}")
