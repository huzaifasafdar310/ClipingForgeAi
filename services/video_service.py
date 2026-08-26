import os
import sys
import shutil
import tempfile
import subprocess
import logging
import yt_dlp
import imageio_ffmpeg

logger = logging.getLogger(__name__)

# Common browser User-Agent for yt-dlp requests to avoid bot detection
_YT_USER_AGENT = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
    'AppleWebKit/537.36 (KHTML, like Gecko) '
    'Chrome/125.0.0.0 Safari/537.36'
)

# Robust extractor args: try multiple player clients so YouTube can't block all of them
_YT_EXTRACTOR_ARGS = {
    'youtube': {
        'player_client': ['web', 'ios', 'android', 'mweb'],
    }
}

# Format selection with multiple fallbacks: prefer a single-stream mp4 to avoid needing ffmpeg merge
_YT_FORMAT = 'best[ext=mp4][height<=720]/best[height<=720]/best[ext=mp4]/best'


def get_ffmpeg_path() -> str:
    """Returns absolute path to working ffmpeg executable provided by imageio-ffmpeg."""
    try:
        path = imageio_ffmpeg.get_ffmpeg_exe()
        if os.path.exists(path):
            ffmpeg_dir = os.path.dirname(path)
            proper_name = 'ffmpeg.exe' if sys.platform == 'win32' else 'ffmpeg'
            proper_path = os.path.join(ffmpeg_dir, proper_name)
            if os.path.exists(proper_path):
                return proper_path
            return path
    except Exception as e:
        logger.warning(f"Could not get imageio-ffmpeg path: {e}")
    return 'ffmpeg'


def get_ffprobe_path() -> str:
    """
    Returns absolute path to working ffprobe executable cross-platform (Windows, Linux, macOS).
    """
    try:
        ffmpeg_exe = get_ffmpeg_path()
        if ffmpeg_exe and os.path.exists(ffmpeg_exe):
            ffmpeg_dir = os.path.dirname(ffmpeg_exe)
            ffprobe_name = 'ffprobe.exe' if sys.platform == 'win32' else 'ffprobe'
            candidate = os.path.join(ffmpeg_dir, ffprobe_name)
            if os.path.exists(candidate):
                return candidate
    except Exception as e:
        logger.warning(f"Error resolving ffprobe in ffmpeg directory: {e}")

    # Fallback to system PATH
    sys_probe = shutil.which('ffprobe')
    if sys_probe:
        return sys_probe

    return 'ffprobe'


def _ensure_ffmpeg_on_path():
    """
    yt-dlp's FFmpegFD.available() checks os.environ['PATH'] directly rather than
    relying only on ffmpeg_location when processing download_ranges.
    Adding ffmpeg's directory to os.environ['PATH'] ensures yt-dlp detects ffmpeg correctly.
    """
    try:
        ffmpeg_exe = get_ffmpeg_path()
        if ffmpeg_exe and os.path.exists(ffmpeg_exe):
            ffmpeg_dir = os.path.dirname(ffmpeg_exe)
            if ffmpeg_dir not in os.environ.get('PATH', ''):
                os.environ['PATH'] = ffmpeg_dir + os.pathsep + os.environ.get('PATH', '')
                logger.info(f"Added FFmpeg directory to PATH: {ffmpeg_dir}")
    except Exception as e:
        logger.warning(f"Failed to append FFmpeg dir to PATH: {e}")


# Ensure PATH is set on module import
_ensure_ffmpeg_on_path()


def _get_ytdlp_ffmpeg_dir() -> tuple:
    """
    yt-dlp looks for a binary literally named 'ffmpeg' / 'ffmpeg.exe' in the
    given directory. imageio-ffmpeg ships it with a versioned name like
    'ffmpeg-win-x86_64-v7.1.exe', which yt-dlp cannot find by name.

    This helper creates a temporary directory containing a hard-link (or copy)
    named 'ffmpeg.exe' / 'ffmpeg' that points to the real binary.
    Returns (ffmpeg_dir, temp_dir_to_cleanup)
    """
    ffmpeg_exe = get_ffmpeg_path()

    basename = os.path.basename(ffmpeg_exe).lower()
    if basename in ('ffmpeg', 'ffmpeg.exe'):
        return os.path.dirname(ffmpeg_exe), None

    temp_dir = tempfile.mkdtemp(prefix='ytdlp_ffmpeg_')
    target_name = 'ffmpeg.exe' if sys.platform == 'win32' else 'ffmpeg'
    target_path = os.path.join(temp_dir, target_name)

    try:
        os.link(ffmpeg_exe, target_path)
    except OSError:
        shutil.copy2(ffmpeg_exe, target_path)

    return temp_dir, temp_dir


def download_clip_segment(video_url: str, clip_id: str, start_seconds: float, end_seconds: float, clips_folder: str) -> str:
    """
    Downloads ONLY the required time segment of a YouTube video using yt-dlp's
    download_ranges option. Avoids downloading the full video.
    """
    _ensure_ffmpeg_on_path()
    os.makedirs(clips_folder, exist_ok=True)

    buffer = 2.0
    seg_start = max(0.0, start_seconds - buffer)
    seg_end = end_seconds + buffer

    target_pattern = os.path.join(clips_folder, f'seg_{clip_id}.mp4')

    if os.path.exists(target_pattern) and os.path.getsize(target_pattern) > 0:
        return target_pattern

    ffmpeg_dir, temp_dir = _get_ytdlp_ffmpeg_dir()

    ydl_opts = {
        'format': _YT_FORMAT,
        'outtmpl': target_pattern,
        'ffmpeg_location': ffmpeg_dir,
        'quiet': True,
        'no_warnings': True,
        'retries': 5,
        'fragment_retries': 5,
        'socket_timeout': 60,
        'download_ranges': yt_dlp.utils.download_range_func(None, [(seg_start, seg_end)]),
        'force_keyframes_at_cuts': False,
        'extractor_args': _YT_EXTRACTOR_ARGS,
        'http_headers': {
            'User-Agent': _YT_USER_AGENT,
            'Accept-Language': 'en-US,en;q=0.9',
        },
    }

    try:
        logger.info(f"Downloading segment [{seg_start:.1f}s – {seg_end:.1f}s] for clip {clip_id}...")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])

        if not os.path.exists(target_pattern) or os.path.getsize(target_pattern) == 0:
            raise RuntimeError("Downloaded video segment is missing or 0 bytes.")

        return target_pattern

    except yt_dlp.utils.DownloadError as ydl_err:
        err_msg = str(ydl_err)
        if 'Private video' in err_msg or 'Sign in' in err_msg:
            raise RuntimeError("YouTube video is private or requires sign-in authorization.")
        elif 'Video unavailable' in err_msg:
            raise RuntimeError("This YouTube video is unavailable or restricted in this region.")
        else:
            raise RuntimeError(f"YouTube video stream download failed: {err_msg[:180]}")

    except Exception as e:
        logger.error(f"Error in download_clip_segment: {e}", exc_info=True)
        raise RuntimeError(f"Failed to extract video segment from YouTube: {str(e)}")

    finally:
        if temp_dir and os.path.isdir(temp_dir):
            try:
                shutil.rmtree(temp_dir)
            except Exception:
                pass


def download_source_video(video_url: str, video_id: str, clips_folder: str) -> str:
    """Downloads the full YouTube video ONCE using yt-dlp."""
    _ensure_ffmpeg_on_path()
    os.makedirs(clips_folder, exist_ok=True)
    target_pattern = os.path.join(clips_folder, f'full_{video_id}.mp4')

    if os.path.exists(target_pattern) and os.path.getsize(target_pattern) > 0:
        return target_pattern

    ffmpeg_dir, temp_dir = _get_ytdlp_ffmpeg_dir()

    ydl_opts = {
        'format': _YT_FORMAT,
        'outtmpl': target_pattern,
        'merge_output_format': 'mp4',
        'ffmpeg_location': ffmpeg_dir,
        'quiet': True,
        'no_warnings': True,
        'retries': 5,
        'fragment_retries': 5,
        'socket_timeout': 60,
        'extractor_args': _YT_EXTRACTOR_ARGS,
        'http_headers': {
            'User-Agent': _YT_USER_AGENT,
            'Accept-Language': 'en-US,en;q=0.9',
        },
    }

    try:
        logger.info(f"Downloading full source video {video_url} via yt-dlp...")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])

        if not os.path.exists(target_pattern) or os.path.getsize(target_pattern) == 0:
            raise RuntimeError("Full video download completed but target file is missing or empty.")

        return target_pattern
    finally:
        if temp_dir and os.path.isdir(temp_dir):
            try:
                shutil.rmtree(temp_dir)
            except Exception:
                pass


def cut_and_format_clip(source_video_path: str, start_seconds: float, duration_seconds: float, output_clip_path: str) -> str:
    """
    Cuts a segment from local source video and formats to 9:16 vertical ratio (720x1280) with stereo AAC audio.
    """
    if not os.path.exists(source_video_path):
        raise RuntimeError(f"Source video file not found at {source_video_path}")

    if os.path.getsize(source_video_path) == 0:
        raise RuntimeError(f"Source video file at {source_video_path} is empty (0 bytes).")

    start_seconds = max(0.0, float(start_seconds))
    duration_seconds = max(1.0, float(duration_seconds))

    ffmpeg_exe = get_ffmpeg_path()

    cmd = [
        ffmpeg_exe, '-y',
        '-ss', str(start_seconds),
        '-i', source_video_path,
        '-t', str(duration_seconds),
        '-vf', 'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100',
        '-ac', '2',
        '-avoid_negative_ts', 'make_zero',
        '-fflags', '+genpts',
        '-max_muxing_queue_size', '1024',
        output_clip_path
    ]

    logger.info(f"Running FFmpeg cut command: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0 or not os.path.exists(output_clip_path) or os.path.getsize(output_clip_path) == 0:
        error_msg = result.stderr or result.stdout or "Unknown FFmpeg error"
        logger.error(f"FFmpeg failed: {error_msg}")
        raise RuntimeError(f"FFmpeg video cut failed: {error_msg[:250]}")

    return output_clip_path


def extract_and_cut_segment(
    video_url: str,
    clip_id: str,
    start_seconds: float,
    end_seconds: float,
    clips_folder: str,
    output_clip_path: str
) -> str:
    """
    Canonical de-duplicated segment processing function with cleanup guarantees.
    """
    os.makedirs(clips_folder, exist_ok=True)
    is_local = video_url.startswith('local:')
    duration = max(1.0, float(end_seconds) - float(start_seconds))
    seg_path = None

    try:
        if is_local:
            local_path = video_url[len('local:'):]
            if not os.path.exists(local_path):
                raise RuntimeError(f"Uploaded source video file not found at: {local_path}")
            cut_and_format_clip(
                source_video_path=local_path,
                start_seconds=float(start_seconds),
                duration_seconds=duration,
                output_clip_path=output_clip_path
            )
        else:
            seg_path = download_clip_segment(
                video_url=video_url,
                clip_id=str(clip_id),
                start_seconds=float(start_seconds),
                end_seconds=float(end_seconds),
                clips_folder=clips_folder
            )
            seg_offset = min(float(start_seconds), 2.0)
            cut_and_format_clip(
                source_video_path=seg_path,
                start_seconds=seg_offset,
                duration_seconds=duration,
                output_clip_path=output_clip_path
            )

        return output_clip_path

    finally:
        if not is_local and seg_path and os.path.exists(seg_path):
            try:
                os.remove(seg_path)
            except Exception:
                pass


def cleanup_source_video(source_video_path: str):
    """Clean up source full video after clips are created"""
    if os.path.exists(source_video_path):
        try:
            os.remove(source_video_path)
        except Exception:
            pass
