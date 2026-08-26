import os
import sys
import time
import json
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv

load_dotenv()

HANDLES = [
    "MrBeast",
    "PewDiePie",
    "MarkRober",
    "Tseries",
    "DudePerfect",
    "StokesTwins",
    "LikeNastyaofficial",
    "VladandNiki",
    "KidsDianaShow",
    "AlanChikinChow",
    "fedevigevani",
    "KIMPRO828",
    "alejoigoa",
    "loganpaulvlogs",
    "KSI",
    "RyanTrahan",
    "CaseyNeistat",
    "mkbhd",
    "LinusTechTips",
    "veritasium",
    "kurzgesagt",
    "Fireship",
    "aliabdaal",
    "Mrwhosetheboss",
    "unboxtherapy",
    "iJustine",
    "PeterMcKinnon",
    "ZachKing",
    "DharMann",
    "airrack",
    "Sidemen",
    "JellyYT",
    "SSundee",
    "Dream",
    "TommyInnit",
    "Technoblade",
    "jacksepticeye",
    "Markiplier",
    "VanossGaming",
    "Ninja",
    "Pokimane",
    "MrBeastGaming",
    "theslowmoguys",
    "howridiculous",
    "GoodMythicalMorning",
    "tryguys",
    "YesTheory",
    "ColinandSamir",
    "BeastPhilanthropy",
    "RyansWorld",
    "Blippi",
    "CoComelon",
    "5MinuteCraftsYouTube",
    "BRIGHTSIDEOFFICIAL",
    "zeemusiccompany",
    "WWE",
    "cristiano",
    "Jesser",
    "rug",
    "FaZe",
    "LazarBeam",
    "Preston",
    "Unspeakable",
    "DanTDM",
    "smosh",
    "PhilipDeFranco",
    "fallontonight",
    "TheLateLateShow",
    "TrevorNoah",
    "joerogan",
    "lexfridman",
    "t3dotgg",
    "ThePrimeTimeagen",
    "TraversyMedia",
    "freecodecamp",
    "programmingwithmosh",
    "NetNinja",
    "coreyms",
    "TechWithTim",
    "NetworkChuck",
    "TheCodingTrain",
    "cs50",
    "TED",
    "TEDEd",
    "GameTheory",
    "SmarterEveryDay",
    "Vsauce",
    "TheInfographicsShow",
    "BeastReact",
    "MrBeastShorts",
    "MusaInSHORTS",
    "CokeStudioPakistan",
    "harpalgeoofficial",
    "ARYDigitalasia",
    "HUMTV",
    "geonews",
    "ARYNews",
    "MinsaSaimOmer",
]


def resolve_channel_by_handle(handle: str, api_key: str):
    url = "https://www.googleapis.com/youtube/v3/channels"
    clean_handle = handle.replace("@", "").strip()

    # 1. Try forHandle
    params = {
        "part": "snippet,statistics",
        "forHandle": clean_handle,
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
                    "channel_title": snippet.get("title", clean_handle),
                    "channel_thumbnail": snippet.get("thumbnails", {}).get("medium", {}).get("url")
                    or snippet.get("thumbnails", {}).get("default", {}).get("url", ""),
                    "subscriber_count": formatted_subs,
                    "video_count": f"{stats.get('videoCount', '0')} Videos",
                    "handle": f"@{clean_handle}",
                }

        # 2. Fallback: Search API
        search_url = "https://www.googleapis.com/youtube/v3/search"
        search_params = {
            "part": "snippet",
            "type": "channel",
            "q": clean_handle,
            "maxResults": 1,
            "key": api_key,
        }
        s_res = requests.get(search_url, params=search_params, timeout=10)
        if s_res.status_code == 200:
            s_data = s_res.json()
            s_items = s_data.get("items", [])
            if s_items:
                c_id = s_items[0].get("id", {}).get("channelId")
                c_snippet = s_items[0].get("snippet", {})
                return {
                    "channel_id": c_id,
                    "channel_title": c_snippet.get("title", clean_handle),
                    "channel_thumbnail": c_snippet.get("thumbnails", {}).get("medium", {}).get("url")
                    or c_snippet.get("thumbnails", {}).get("default", {}).get("url", ""),
                    "subscriber_count": "Verified Creator",
                    "video_count": "N/A",
                    "handle": f"@{clean_handle}",
                }

    except Exception:
        pass

    return None


def main():
    from app_factory import create_app
    from models import db, SourceChannel, User

    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key:
        print("ERROR: YOUTUBE_API_KEY is not configured in .env.")
        return

    print(f"Resolving {len(HANDLES)} YouTube channels concurrently (ThreadPoolExecutor)...")
    resolved = []
    failed = []

    with ThreadPoolExecutor(max_workers=8) as executor:
        future_to_handle = {
            executor.submit(resolve_channel_by_handle, h, api_key): h for h in HANDLES
        }
        for future in as_completed(future_to_handle):
            h = future_to_handle[future]
            try:
                data = future.result()
                if data and data.get("channel_id"):
                    resolved.append(data)
                else:
                    failed.append(h)
            except Exception:
                failed.append(h)

    print(f"Resolved {len(resolved)} / {len(HANDLES)} channels successfully!")

    app = create_app()
    with app.app_context():
        # Save to curated_channels.json
        json_path = os.path.join(app.root_path, "curated_channels.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(resolved, f, indent=2, ensure_ascii=False)
        print(f"Saved {len(resolved)} curated channels to {json_path}")

        # Seed into DB
        users = db.session.query(User).all()
        user_ids = [u.id for u in users] if users else ["default_curated_user"]

        for chan in resolved:
            for uid in user_ids:
                existing = db.session.query(SourceChannel).filter_by(
                    channel_id=chan["channel_id"],
                    added_by_user_id=uid
                ).first()

                if existing:
                    existing.channel_title = chan["channel_title"]
                    existing.channel_thumbnail = chan["channel_thumbnail"]
                    existing.subscriber_count = chan["subscriber_count"]
                    existing.video_count = chan["video_count"]
                    existing.is_active = True
                else:
                    new_chan = SourceChannel(
                        channel_id=chan["channel_id"],
                        channel_title=chan["channel_title"],
                        channel_thumbnail=chan["channel_thumbnail"],
                        subscriber_count=chan["subscriber_count"],
                        video_count=chan["video_count"],
                        added_by_user_id=uid,
                        license_filter="all",
                        is_active=True,
                    )
                    db.session.add(new_chan)

        db.session.commit()
        print("Database seeded with all tracked channels!")


if __name__ == "__main__":
    main()
