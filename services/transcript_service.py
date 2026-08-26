import logging
import math

logger = logging.getLogger(__name__)

def fetch_youtube_transcript(video_id: str):
    """
    Fetches transcript for a YouTube video using youtube-transcript-api.
    Returns list of objects/dicts or None if transcript unavailable.
    """
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        api = YouTubeTranscriptApi()
        
        # Try fetching primary transcript
        try:
            transcript = api.fetch(video_id, languages=['en', 'en-US', 'en-GB'])
            logger.info(f"Successfully fetched primary English transcript for video {video_id}")
            return transcript
        except Exception as e:
            logger.warning(f"Default English transcript fetch failed for {video_id}: {e}. Trying default fetch...")
            transcript = api.fetch(video_id)
            return transcript

    except Exception as e:
        logger.warning(f"Failed to fetch any transcript for video {video_id}: {e}")
        return None

def format_transcript_for_prompt(transcript, max_chars=20000) -> str:
    """
    Formats raw transcript items into a readable timed text block for AI prompt analysis.
    For long transcripts (>max_chars), employs uniform representative sampling across the entire
    duration so full-length podcasts and long videos have highlight discovery from start to finish.
    """
    if not transcript:
        return ""
    
    raw_lines = []
    for item in transcript:
        if hasattr(item, 'start'):
            start_val = item.start
            text_val = item.text
        elif isinstance(item, dict):
            start_val = item.get('start', 0)
            text_val = item.get('text', '')
        else:
            continue

        start_min = int(start_val // 60)
        start_sec = int(start_val % 60)
        timestamp = f"[{start_min:02d}:{start_sec:02d}]"
        clean_text = str(text_val).replace('\n', ' ').strip()
        if clean_text:
            raw_lines.append(f"{timestamp} {clean_text}")

    if not raw_lines:
        return ""

    full_text = "\n".join(raw_lines)
    if len(full_text) <= max_chars:
        return full_text

    # Representative stride sampling across full video length
    target_lines = int(max_chars / 65)  # approx 65 chars per line
    step = len(raw_lines) / max(1, target_lines)
    sampled_lines = []
    for i in range(target_lines):
        idx = min(len(raw_lines) - 1, int(i * step))
        sampled_lines.append(raw_lines[idx])

    logger.info(f"Sampled {len(sampled_lines)} lines across full transcript duration ({len(raw_lines)} total lines).")
    return "\n".join(sampled_lines)
