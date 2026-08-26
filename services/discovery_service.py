import os
import re
import json
import logging
import requests
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


def load_curated_channels() -> List[Dict[str, Any]]:
    """Loads pre-indexed top YouTube creator channels from curated_channels.json."""
    curated_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'curated_channels.json')
    if os.path.exists(curated_path):
        try:
            with open(curated_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load curated channels: {e}")
    return []


def resolve_channel_by_handle_or_url(query: str) -> Optional[Dict[str, Any]]:
    """
    Directly resolves a YouTube handle (@MrBeast) or channel URL to channel metadata.
    """
    api_key = os.getenv('YOUTUBE_API_KEY')
    if not api_key:
        return None

    clean = query.strip()
    handle_match = re.search(r'@([a-zA-Z0-9_\-\.]+)', clean)
    handle = handle_match.group(1) if handle_match else (clean[1:] if clean.startswith('@') else None)

    if handle:
        url = "https://www.googleapis.com/youtube/v3/channels"
        params = {
            "part": "snippet,statistics",
            "forHandle": handle,
            "key": api_key,
        }
        try:
            res = requests.get(url, params=params, timeout=10)
            if res.status_code == 200:
                data = res.json()
                items = data.get("items", [])
                if items:
                    item = items[0]
                    stats = item.get("statistics", {})
                    snippet = item.get("snippet", {})
                    raw_subs = stats.get("subscriberCount")
                    if raw_subs and raw_subs.isdigit():
                        sub_int = int(raw_subs)
                        if sub_int >= 1_000_000:
                            formatted_subs = f"{sub_int / 1_000_000:.1f}M Subscribers"
                        elif sub_int >= 1_000:
                            formatted_subs = f"{sub_int / 1_000:.1f}K Subscribers"
                        else:
                            formatted_subs = f"{sub_int} Subscribers"
                    else:
                        formatted_subs = "Creator"

                    return {
                        "channel_id": item.get("id"),
                        "channel_title": snippet.get("title", f"@{handle}"),
                        "channel_thumbnail": snippet.get("thumbnails", {}).get("medium", {}).get("url")
                        or snippet.get("thumbnails", {}).get("default", {}).get("url", ""),
                        "subscriber_count": formatted_subs,
                        "video_count": f"{stats.get('videoCount', '0')} Videos",
                        "sample_video_title": f"Official channel of @{handle}",
                        "sample_video_id": "",
                        "license": "YouTube Partner / Creator",
                    }
        except Exception:
            pass

    return None


def discover_creative_commons_channels(query: str = "technology podcast", max_results: int = 12) -> List[Dict[str, Any]]:
    """
    Discovers YouTube channels based on search query, handles, or Creative Commons topics.
    """
    api_key = os.getenv('YOUTUBE_API_KEY')
    if not api_key:
        raise RuntimeError("YOUTUBE_API_KEY is not configured in .env file.")

    clean_q = (query or "").strip()

    # 1. Check if user searched for a specific handle (@handle or URL)
    if clean_q.startswith('@') or 'youtube.com/@' in clean_q or 'youtube.com/c/' in clean_q or 'youtube.com/channel/' in clean_q:
        direct = resolve_channel_by_handle_or_url(clean_q)
        if direct:
            return [direct]

    # 2. Check in pre-indexed curated list
    curated = load_curated_channels()
    if clean_q:
        matched = [
            c for c in curated
            if clean_q.lower() in c.get('channel_title', '').lower()
            or clean_q.lower() in c.get('handle', '').lower()
        ]
        if matched:
            return matched[:max_results]

    if not clean_q:
        clean_q = "podcast interview creative commons"

    search_url = 'https://www.googleapis.com/youtube/v3/search'
    search_params = {
        'part': 'snippet',
        'type': 'video',
        'videoLicense': 'creativeCommon',
        'q': clean_q,
        'maxResults': min(max(max_results, 5), 25),
        'key': api_key
    }

    try:
        res = requests.get(search_url, params=search_params, timeout=12)
        if res.status_code != 200:
            err_data = res.json() if res.text else {}
            err_msg = err_data.get('error', {}).get('message', f"HTTP {res.status_code}")
            logger.error(f"YouTube search error during discovery: {err_msg}")
            return curated[:max_results] if curated else []

        search_data = res.json()
        items = search_data.get('items', [])
        if not items:
            return curated[:max_results] if curated else []

        # Extract unique channel IDs and sample titles
        channel_map = {}
        for item in items:
            snippet = item.get('snippet', {})
            c_id = snippet.get('channelId')
            if c_id and c_id not in channel_map:
                channel_map[c_id] = {
                    'channel_id': c_id,
                    'channel_title': snippet.get('channelTitle', 'YouTube Creator'),
                    'sample_video_title': snippet.get('title', ''),
                    'sample_video_id': item.get('id', {}).get('videoId', '')
                }

        channel_ids = list(channel_map.keys())[:15]
        if not channel_ids:
            return []

        # Batch query channel statistics & thumbnails
        channels_url = 'https://www.googleapis.com/youtube/v3/channels'
        channels_params = {
            'part': 'snippet,statistics',
            'id': ','.join(channel_ids),
            'key': api_key
        }

        c_res = requests.get(channels_url, params=channels_params, timeout=12)
        if c_res.status_code != 200:
            return [
                {
                    'channel_id': c['channel_id'],
                    'channel_title': c['channel_title'],
                    'channel_thumbnail': '',
                    'subscriber_count': 'N/A',
                    'video_count': 'N/A',
                    'sample_video_title': c['sample_video_title'],
                    'license': 'Creative Commons (Reuse Allowed)'
                }
                for c in channel_map.values()
            ]

        c_data = c_res.json()
        results = []

        for c_item in c_data.get('items', []):
            c_id = c_item.get('id')
            c_snippet = c_item.get('snippet', {})
            c_stats = c_item.get('statistics', {})

            raw_subs = c_stats.get('subscriberCount')
            if raw_subs and raw_subs.isdigit():
                sub_int = int(raw_subs)
                if sub_int >= 1_000_000:
                    formatted_subs = f"{sub_int / 1_000_000:.1f}M Subscribers"
                elif sub_int >= 1_000:
                    formatted_subs = f"{sub_int / 1_000:.1f}K Subscribers"
                else:
                    formatted_subs = f"{sub_int} Subscribers"
            else:
                formatted_subs = "Creator"

            sample_info = channel_map.get(c_id, {})
            results.append({
                'channel_id': c_id,
                'channel_title': c_snippet.get('title', sample_info.get('channel_title', 'YouTube Creator')),
                'channel_thumbnail': c_snippet.get('thumbnails', {}).get('medium', {}).get('url') or c_snippet.get('thumbnails', {}).get('default', {}).get('url', ''),
                'subscriber_count': formatted_subs,
                'video_count': f"{c_stats.get('videoCount', '0')} Videos",
                'sample_video_title': sample_info.get('sample_video_title', ''),
                'sample_video_id': sample_info.get('sample_video_id', ''),
                'license': 'Creative Commons (Reuse Allowed)'
            })

        return results

    except Exception as e:
        logger.error(f"Exception during CC channel discovery: {e}", exc_info=True)
        return curated[:max_results] if curated else []


def fetch_new_cc_videos_for_channel(
    channel_id: str,
    published_after: Optional[datetime] = None,
    max_results: int = 5,
    license_filter: str = 'all'
) -> List[Dict[str, Any]]:
    """
    Fetches newly uploaded videos from a specific YouTube channel.
    Respects publishedAfter cutoff for incremental polling, with fallback to latest uploads.
    """
    api_key = os.getenv('YOUTUBE_API_KEY')
    if not api_key:
        raise RuntimeError("YOUTUBE_API_KEY is not configured.")

    search_url = 'https://www.googleapis.com/youtube/v3/search'
    params = {
        'part': 'snippet',
        'channelId': channel_id,
        'type': 'video',
        'order': 'date',
        'maxResults': min(max(max_results, 1), 10),
        'key': api_key
    }

    if license_filter == 'creativeCommon':
        params['videoLicense'] = 'creativeCommon'

    if published_after:
        params['publishedAfter'] = published_after.strftime('%Y-%m-%dT%H:%M:%SZ')

    try:
        res = requests.get(search_url, params=params, timeout=12)
        data = res.json() if res.status_code == 200 else {}
        items = data.get('items', [])

        # Fallback to recent uploads if incremental window yielded 0 results
        if not items and published_after:
            fallback_params = dict(params)
            fallback_params.pop('publishedAfter', None)
            f_res = requests.get(search_url, params=fallback_params, timeout=12)
            if f_res.status_code == 200:
                items = f_res.json().get('items', [])

        videos = []
        for item in items:
            video_id = item.get('id', {}).get('videoId')
            snippet = item.get('snippet', {})
            if video_id:
                videos.append({
                    'video_id': video_id,
                    'title': snippet.get('title', 'YouTube Video'),
                    'description': snippet.get('description', ''),
                    'published_at': snippet.get('publishedAt'),
                    'thumbnail': snippet.get('thumbnails', {}).get('high', {}).get('url', ''),
                    'video_url': f"https://www.youtube.com/watch?v={video_id}"
                })

        return videos

    except Exception as e:
        logger.error(f"Error fetching videos for channel {channel_id}: {e}")
        return []
