from datetime import datetime, timedelta

import pytest

from app.config import BEIJING_TZ
from app.services import mteam_api
from app.services.media_wall import (
    MediaWallService,
    _search_payloads,
    build_media_wall_rails,
    classify_media_type,
    extract_episode_token,
    extract_quality_tags,
    is_media_wall_movie_candidate,
    is_media_wall_series_candidate,
)
from app.services.mteam_api import MTClient


def torrent_item(
    *,
    id="1",
    name="Example Movie 2026 2160p BluRay REMUX HEVC Atmos TrueHD 中字-Team",
    category=419,
    created=None,
    seeders=12,
    leechers=30,
    times_completed=3,
    douban="https://www.douban.com/subject/1234567/",
    imdb="tt1234567",
    small_descr="动作 科幻",
):
    return {
        "id": id,
        "name": name,
        "category": category,
        "createdDate": created or datetime.now(BEIJING_TZ).isoformat(),
        "size": 50 * 1024**3,
        "smallDescr": small_descr,
        "douban": douban,
        "imdb": imdb,
        "doubanRating": "8.8",
        "imdbRating": "8.2",
        "status": {
            "seeders": seeders,
            "leechers": leechers,
            "timesCompleted": times_completed,
            "discount": "NORMAL",
        },
    }


def metadata(
    *,
    title="Example Movie",
    year="2026",
    cover="https://img.example/poster.webp",
    intro="A sample movie.",
):
    return {
        "title": title,
        "year": year,
        "coverUrl": cover,
        "intro": intro,
        "genres": ["动作", "科幻"],
        "rating": {"value": "8.8"},
    }


EXPECTED_HOME_RAIL_IDS = [
    "western_series",
    "foreign_movies",
    "asian_series",
    "chinese_series",
    "classic_restorations",
    "quality_latest",
    "popular_media",
]


def rail_items(response, rail_id):
    return next(rail["items"] for rail in response["rails"] if rail["id"] == rail_id)


def all_rail_item_ids(response):
    return {
        item["id"]
        for rail in response["rails"]
        for item in rail.get("items", [])
    }


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("Show.Name.S01E05.1080p.WEB-DL", "S01E05"),
        ("Anime Title EP12 1080p HEVC", "EP12"),
        ("国产剧 第5集 2160p WEB-DL", "第5集"),
        ("Movie 2026 2160p BluRay", None),
    ],
)
def test_extract_episode_token(name, expected):
    assert extract_episode_token(name) == expected


@pytest.mark.parametrize(
    ("category", "name", "expected"),
    [
        (419, "Movie 2160p", "movie"),
        (402, "Show S01E01", "series"),
        (405, "Anime EP01", "anime"),
        (449, "Anime Movie", "anime"),
        (999, "Unknown S02E03", "series"),
    ],
)
def test_classify_media_type(category, name, expected):
    assert classify_media_type({"category": category, "name": name}) == expected


def test_movie_disc_category_with_season_marker_is_classified_as_series():
    torrent = {
        "category": 421,
        "name": "Fallout S02 UHD BluRay 2160p HEVC Atmos TrueHD7.1-MTeam",
        "smallDescr": "辐射 第二季 / 异尘余生 第二季(港/台)",
    }

    assert classify_media_type(torrent) == "series"


def test_media_wall_search_payloads_reuse_radar_movie_and_tvshow_categories():
    payloads = _search_payloads()

    assert payloads["movies"]["categories"] == [439, 421, 419, 420, 401]
    assert payloads["series"]["categories"] == [438, 402, 435, 403]
    assert payloads["latest"]["categories"] == [439, 421, 419, 420, 401, 438, 402, 435, 403]
    assert payloads["latest"]["pageSize"] == 200
    assert payloads["movies"]["pageSize"] == 200
    assert payloads["series"]["pageSize"] == 200
    assert payloads["hot"]["pageSize"] == 200
    assert "anime" not in payloads


def test_extract_quality_tags_keeps_expected_order_and_deduplicates():
    tags = extract_quality_tags(
        "Film 2160p 4K BluRay REMUX H.265 HEVC Atmos TrueHD 中字 2160p"
    )

    assert tags == ["4K", "2160p", "Remux", "BluRay", "H.265", "Atmos", "TrueHD", "中字"]


def test_build_media_wall_rails_returns_family_4k_preference_rails():
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    created = now.isoformat()

    western_episode = torrent_item(
        id="western-series",
        category=402,
        name="Slow Horses S05E01 2160p Apple TV+ WEB-DL DDP5.1 Atmos DoVi HDR HEVC",
        created=created,
        douban="douban-western",
        small_descr="英国 | 剧情 / 惊悚 | 第五季第1集",
    )
    foreign_movie = torrent_item(
        id="foreign-movie",
        category=419,
        name="F1 The Movie 2025 2160p UHD BluRay REMUX DoVi HDR10 HEVC Atmos",
        created=created,
        douban="douban-foreign",
        small_descr="美国 | 剧情 / 动作",
    )
    asian_episode = torrent_item(
        id="asian-series",
        category=402,
        name="Tokyo Story S01E02 2160p Netflix WEB-DL HEVC HDR",
        created=created,
        douban="douban-asian",
        small_descr="日本 | 剧情 | 第1季第2集",
    )
    chinese_episode = torrent_item(
        id="chinese-series",
        category=402,
        name="The Tang Mist S01E05 2160p TX WEB-DL AAC2.0 H.265",
        created=created,
        douban="douban-chinese",
        small_descr="中国大陆 | 悬疑 古装 | 第1季第5集",
    )
    classic_restoration = torrent_item(
        id="classic",
        category=439,
        name="Heat 1995 2160p UHD BluRay REMUX HDR10 HEVC TrueHD Atmos",
        created=created,
        douban="douban-classic",
        small_descr="美国 | 犯罪 / 剧情",
        leechers=180,
    )
    old_version_not_recent_movie = torrent_item(
        id="old-version",
        category=419,
        name="Seoul Raiders 2005 2160p UHD BluRay REMUX HEVC",
        created=created,
        douban="douban-old-version",
        small_descr="香港 | 动作",
    )
    non_4k_episode = torrent_item(
        id="non-4k-series",
        category=402,
        name="Slow Horses S05E02 1080p Apple TV+ WEB-DL H.264",
        created=created,
        douban="douban-non-4k",
        small_descr="英国 | 剧情 / 惊悚 | 第五季第2集",
    )

    response = build_media_wall_rails(
        torrents_by_source={
            "latest": [
                western_episode,
                foreign_movie,
                asian_episode,
                chinese_episode,
                old_version_not_recent_movie,
                non_4k_episode,
            ],
            "movies": [foreign_movie, old_version_not_recent_movie],
            "series": [western_episode, asian_episode, chinese_episode, non_4k_episode],
            "hot": [classic_restoration, old_version_not_recent_movie],
        },
        metadata_by_key={
            "douban-western": metadata(title="Slow Horses", year="2026", intro="英国 | 剧情"),
            "douban-foreign": metadata(title="F1: The Movie", year="2025", intro="美国 | 剧情"),
            "douban-asian": metadata(title="Tokyo Story", year="2026", intro="日本 | 剧情"),
            "douban-chinese": metadata(title="The Tang Mist", year="2026", intro="中国大陆 | 悬疑 古装"),
            "douban-classic": metadata(title="Heat", year="1995", intro="美国 | 犯罪 / 剧情"),
            "douban-old-version": metadata(title="Seoul Raiders", year="2005", intro="香港 | 动作"),
            "douban-non-4k": metadata(title="Slow Horses", year="2026", intro="英国 | 剧情"),
        },
        now=now,
        items_per_rail=8,
    )

    assert [rail["id"] for rail in response["rails"]] == EXPECTED_HOME_RAIL_IDS
    items_by_rail = {rail["id"]: rail["items"] for rail in response["rails"]}
    western_ids = [item["id"] for item in items_by_rail["western_series"]]
    assert western_ids == ["western-series", "non-4k-series"]
    assert {"4K", "2160p"} & set(items_by_rail["western_series"][0]["quality_tags"])
    assert not ({"4K", "2160p"} & set(items_by_rail["western_series"][1]["quality_tags"]))
    assert [item["id"] for item in items_by_rail["foreign_movies"]] == ["foreign-movie"]
    assert [item["id"] for item in items_by_rail["asian_series"]] == ["asian-series"]
    assert [item["id"] for item in items_by_rail["chinese_series"]] == ["chinese-series"]
    assert items_by_rail["classic_restorations"][0]["id"] == "classic"
    assert "old-version" not in [item["id"] for item in items_by_rail["foreign_movies"]]
    boutique_items = [item for rail in response["rails"][:5] for item in rail["items"]]
    assert all({"4K", "2160p", "1080p"} & set(item["quality_tags"]) for item in boutique_items)


def test_family_media_wall_requires_4k_release_name_not_description_only():
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    misleading_description = torrent_item(
        id="description-only-4k",
        category=419,
        name="False Positive 2026 1080p BluRay H.264",
        douban="douban-description-only",
        small_descr="美国 | 4K 修复版相关介绍 | 剧情",
    )

    response = build_media_wall_rails(
        torrents_by_source={
            "latest": [misleading_description],
            "movies": [misleading_description],
            "series": [],
            "hot": [misleading_description],
        },
        metadata_by_key={
            "douban-description-only": metadata(
                title="False Positive",
                year="2026",
                intro="美国 | 4K 修复版相关介绍 | 剧情",
            )
        },
        now=now,
        items_per_rail=8,
    )

    assert "description-only-4k" in all_rail_item_ids(response)
    assert response["diagnostics"]["rails"]["foreign_movies"]["strict"] == 0
    assert response["diagnostics"]["rails"]["foreign_movies"]["relaxed"] == 1


def test_family_media_wall_routes_asian_and_chinese_series_before_english_subtitles():
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    korean_episode = torrent_item(
        id="korean",
        category=402,
        name="Mercy for None S01E04 2160p Netflix WEB-DL H.265 English Subs",
        douban="douban-korean",
        small_descr="韩国 | 韩语 | 英语字幕 | 第1季第4集",
    )
    chinese_episode = torrent_item(
        id="chinese",
        category=402,
        name="Twin Fire Dawn S01E12 2160p TX WEB-DL H.265 English Subs",
        douban="douban-chinese-subtitles",
        small_descr="中国大陆 | 汉语普通话 | 英语字幕 | 第1季第12集",
    )

    response = build_media_wall_rails(
        torrents_by_source={
            "latest": [korean_episode, chinese_episode],
            "movies": [],
            "series": [korean_episode, chinese_episode],
            "hot": [],
        },
        metadata_by_key={
            "douban-korean": metadata(title="Mercy for None", year="2026", intro="韩国 | 韩语"),
            "douban-chinese-subtitles": metadata(title="Twin Fire Dawn", year="2026", intro="中国大陆 | 汉语普通话"),
        },
        now=now,
        items_per_rail=8,
    )

    assert [item["id"] for item in rail_items(response, "asian_series")] == ["korean"]
    assert [item["id"] for item in rail_items(response, "chinese_series")] == ["chinese"]
    assert "korean" not in [item["id"] for item in rail_items(response, "western_series")]
    assert "chinese" not in [item["id"] for item in rail_items(response, "western_series")]


def test_family_media_wall_routes_english_audio_series_to_western_without_metadata():
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    english_audio_episode = torrent_item(
        id="rooster",
        category=402,
        name="Rooster 2026 S01 2160p MAX WEB-DL H.265 DV HDR10 DDP5.1 Atmos-AilMWeb",
        douban="",
        imdb="",
        small_descr="雄鸡生活 / 公鸡 | 第1季 全10集 | [英语] | [简/繁/英] 软字幕",
    )
    english_subtitle_chinese_episode = torrent_item(
        id="chinese-with-english-subs",
        category=402,
        name="Twin Fire Dawn S01E12 2160p TX WEB-DL H.265 English Subs",
        douban="douban-chinese-subtitles",
        small_descr="燃双为昼 | 2026 | 中国大陆 | 爱情 | 第1季第12集",
    )

    response = build_media_wall_rails(
        torrents_by_source={
            "latest": [english_audio_episode, english_subtitle_chinese_episode],
            "movies": [],
            "series": [english_audio_episode, english_subtitle_chinese_episode],
            "hot": [],
        },
        metadata_by_key={
            "douban-chinese-subtitles": metadata(
                title="Twin Fire Dawn",
                year="2026",
                intro="中国大陆 | 汉语普通话",
            ),
        },
        now=now,
        items_per_rail=8,
    )

    assert [item["id"] for item in rail_items(response, "western_series")] == ["rooster"]
    assert "chinese-with-english-subs" not in [
        item["id"] for item in rail_items(response, "western_series")
    ]
    assert [item["id"] for item in rail_items(response, "chinese_series")] == [
        "chinese-with-english-subs"
    ]


def test_family_media_wall_excludes_chinese_language_movies_from_foreign_movies():
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    hong_kong_movie = torrent_item(
        id="hong-kong",
        category=419,
        name="Hong Kong Story 2026 2160p UHD BluRay HEVC",
        douban="douban-hk",
        small_descr="香港 | 粤语 | 剧情",
    )

    response = build_media_wall_rails(
        torrents_by_source={
            "latest": [hong_kong_movie],
            "movies": [hong_kong_movie],
            "series": [],
            "hot": [],
        },
        metadata_by_key={
            "douban-hk": metadata(title="Hong Kong Story", year="2026", intro="香港 | 粤语 | 剧情")
        },
        now=now,
        items_per_rail=8,
    )

    assert "hong-kong" not in [item["id"] for item in rail_items(response, "foreign_movies")]


def test_family_media_wall_excludes_chinese_country_ids_from_foreign_movies():
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    hong_kong_movie = torrent_item(
        id="hong-kong-country",
        category=419,
        name="Ultimate Revenge 2026 2160p WEB-DL H.265",
        douban="douban-hk-country",
        small_descr="动作 / 犯罪",
    )
    hong_kong_movie["countries"] = ["8", "109"]

    response = build_media_wall_rails(
        torrents_by_source={
            "latest": [hong_kong_movie],
            "movies": [hong_kong_movie],
            "series": [],
            "hot": [],
        },
        metadata_by_key={
            "douban-hk-country": metadata(
                title="Ultimate Revenge",
                year="2026",
                intro="动作 / 犯罪",
            )
        },
        now=now,
        items_per_rail=8,
    )

    assert "hong-kong-country" not in [
        item["id"] for item in rail_items(response, "foreign_movies")
    ]


def test_family_media_wall_excludes_chinese_language_label_from_foreign_movies():
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    chinese_language_movie = torrent_item(
        id="chinese-language",
        category=419,
        name="Language Only Film 2026 2160p UHD BluRay HEVC",
        douban="douban-chinese-language",
        small_descr="华语 | 剧情",
    )

    response = build_media_wall_rails(
        torrents_by_source={
            "latest": [chinese_language_movie],
            "movies": [chinese_language_movie],
            "series": [],
            "hot": [],
        },
        metadata_by_key={
            "douban-chinese-language": {
                **metadata(title="Language Only Film", year="2026", intro="华语 | 剧情"),
                "languages": ["Chinese"],
            }
        },
        now=now,
        items_per_rail=8,
    )

    assert "chinese-language" not in [item["id"] for item in rail_items(response, "foreign_movies")]


def test_family_media_wall_keeps_foreign_movies_with_chinese_subtitle_label():
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    subtitled_foreign_movie = torrent_item(
        id="subtitled-foreign",
        category=419,
        name="Foreign Film 2026 2160p UHD BluRay HEVC Chinese Subs",
        douban="douban-subtitled-foreign",
        small_descr="美国 | 英语 | 剧情 | 中文字幕",
    )

    response = build_media_wall_rails(
        torrents_by_source={
            "latest": [subtitled_foreign_movie],
            "movies": [subtitled_foreign_movie],
            "series": [],
            "hot": [],
        },
        metadata_by_key={
            "douban-subtitled-foreign": metadata(
                title="Foreign Film",
                year="2026",
                intro="美国 | 英语 | 剧情",
            )
        },
        now=now,
        items_per_rail=8,
    )

    assert "subtitled-foreign" in [item["id"] for item in rail_items(response, "foreign_movies")]


def test_recent_foreign_movies_accept_recent_uploads_from_wider_release_window():
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    recent_older_release = torrent_item(
        id="recent-older-release",
        category=419,
        name="Foreign Drama Film 2023 2160p WEB-DL H.265",
        created=(now - timedelta(days=20)).isoformat(),
        douban="douban-recent-older-release",
        small_descr="美国 | 英语 | 剧情",
    )
    old_upload_older_release = torrent_item(
        id="old-upload-older-release",
        category=419,
        name="Foreign Drama Film 2023 2160p WEB-DL H.265",
        created=(now - timedelta(days=240)).isoformat(),
        douban="douban-old-upload-older-release",
        small_descr="美国 | 英语 | 剧情",
    )
    too_old_release = torrent_item(
        id="too-old-release",
        category=419,
        name="Foreign Archive Film 2021 2160p WEB-DL H.265",
        created=(now - timedelta(days=20)).isoformat(),
        douban="douban-too-old-release",
        small_descr="美国 | 英语 | 剧情",
    )

    response = build_media_wall_rails(
        torrents_by_source={
            "latest": [recent_older_release, old_upload_older_release, too_old_release],
            "movies": [recent_older_release, old_upload_older_release, too_old_release],
            "series": [],
            "hot": [],
        },
        metadata_by_key={
            "douban-recent-older-release": metadata(
                title="Foreign Drama Film",
                year="2023",
                intro="美国 | 英语 | 剧情",
            ),
            "douban-old-upload-older-release": metadata(
                title="Foreign Drama Film",
                year="2023",
                intro="美国 | 英语 | 剧情",
            ),
            "douban-too-old-release": metadata(
                title="Foreign Archive Film",
                year="2021",
                intro="美国 | 英语 | 剧情",
            ),
        },
        now=now,
        items_per_rail=8,
    )

    foreign_ids = {item["id"] for item in rail_items(response, "foreign_movies")}
    assert "recent-older-release" in foreign_ids
    assert "old-upload-older-release" not in foreign_ids
    assert "too-old-release" not in foreign_ids


def test_family_media_wall_requires_year_for_recent_movies_and_classics():
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    yearless_foreign_movie = torrent_item(
        id="yearless-foreign",
        category=419,
        name="Mystery Release 2160p UHD BluRay HEVC",
        douban="douban-yearless-foreign",
        small_descr="美国 | 剧情",
    )
    yearless_classic = torrent_item(
        id="yearless-classic",
        category=439,
        name="Archive Release 2160p UHD BluRay REMUX HEVC Atmos",
        douban="douban-yearless-classic",
        small_descr="美国 | 剧情",
    )

    response = build_media_wall_rails(
        torrents_by_source={
            "latest": [yearless_foreign_movie],
            "movies": [yearless_foreign_movie],
            "series": [],
            "hot": [yearless_classic],
        },
        metadata_by_key={
            "douban-yearless-foreign": metadata(title="Mystery Release", year="", intro="美国 | 剧情"),
            "douban-yearless-classic": metadata(title="Archive Release", year="", intro="美国 | 剧情"),
        },
        now=now,
        items_per_rail=8,
    )

    assert {"yearless-foreign", "yearless-classic"}.isdisjoint(all_rail_item_ids(response))


def test_family_media_wall_excludes_anime_non_4k_and_removed_free_window():
    now = datetime.now(BEIJING_TZ)
    old = now - timedelta(days=1)
    older = now - timedelta(days=30)

    torrents_by_source = {
        "latest": [
            torrent_item(id="m1", category=419, created=now.isoformat(), douban="douban-m1"),
            torrent_item(id="s1", category=402, name="Weekly Show S01E05 1080p WEB-DL", created=now.isoformat(), douban="douban-s1"),
            torrent_item(id="a1", category=405, name="Anime Title EP12 1080p HEVC", created=old.isoformat(), douban="douban-a1"),
        ],
        "movies": [
            torrent_item(id="m2", category=439, name="Recent Film 2025 2160p REMUX Atmos", created=old.isoformat(), douban="douban-m2"),
            torrent_item(id="m3", category=419, name="Old Film 1990 1080p BluRay", created=old.isoformat(), douban="douban-m3"),
        ],
        "series": [
            torrent_item(id="s2", category=402, name="Weekly Show S01E06 1080p WEB-DL", created=now.isoformat(), douban="douban-s2"),
            torrent_item(id="s3", category=402, name="Full Season Pack S01 1080p", created=old.isoformat(), douban="douban-s3"),
        ],
        "anime": [
            torrent_item(id="a2", category=405, name="Anime Title EP13 1080p HEVC", created=now.isoformat(), douban="douban-a2"),
        ],
        "hot": [
            torrent_item(
                id="h1",
                category=439,
                name="Classic Film 1988 2160p UHD BluRay REMUX Atmos TrueHD 中字",
                created=older.isoformat(),
                leechers=180,
                seeders=6,
                douban="douban-h1",
            ),
        ],
    }
    metadata_by_key = {
        "douban-m2": metadata(title="Recent Film", year="2025"),
        "douban-m3": metadata(title="Old Film", year="1990"),
        "douban-s2": metadata(title="Weekly Show", year="2026"),
        "douban-s3": metadata(title="Full Season Pack", year="2024"),
        "douban-a2": metadata(title="Anime Title", year="2026"),
        "douban-h1": metadata(title="Classic Film", year="1988"),
        "https://www.douban.com/subject/1234567/": metadata(title="Example Movie", year="2026"),
    }

    response = build_media_wall_rails(
        torrents_by_source=torrents_by_source,
        metadata_by_key=metadata_by_key,
        now=now,
        items_per_rail=8,
    )

    assert [rail["id"] for rail in response["rails"]] == EXPECTED_HOME_RAIL_IDS
    rail_ids = [rail["id"] for rail in response["rails"]]
    assert "anime_updates" not in rail_ids
    assert "free_window" not in rail_ids
    item_ids = all_rail_item_ids(response)
    assert {"a1", "a2", "s3"}.isdisjoint(item_ids)
    assert {"m1", "m2", "m3", "s1", "s2", "h1"} <= item_ids
    assert rail_items(response, "classic_restorations")[0]["rail_reason"] == "经典 4K 高质量收藏"
    assert rail_items(response, "classic_restorations")[0]["poster_url"] == "https://img.example/poster.webp"
    assert rail_items(response, "classic_restorations")[0]["detail_url"] == "https://kp.m-team.cc/detail/h1"


def test_family_media_wall_dedupes_items_claimed_by_priority_rails():
    now = datetime.now(BEIJING_TZ)
    old = now - timedelta(days=1)
    older = now - timedelta(days=30)

    recent_movie = torrent_item(
        id="m2",
        category=439,
        name="Recent Film 2025 2160p REMUX Atmos",
        created=old.isoformat(),
        douban="douban-m2",
    )
    series_episode = torrent_item(
        id="s2",
        category=402,
        name="Weekly Show S01E06 2160p WEB-DL H.265",
        created=now.isoformat(),
        douban="douban-s2",
        small_descr="英国 | 英语 | 剧情 | 第1季第6集",
    )
    hot_restoration = torrent_item(
        id="h1",
        category=439,
        name="Classic Film 1988 2160p UHD BluRay REMUX Atmos TrueHD 中字",
        created=older.isoformat(),
        leechers=180,
        seeders=6,
        douban="douban-h1",
    )

    response = build_media_wall_rails(
        torrents_by_source={
            "latest": [
                torrent_item(id="m1", category=419, created=now.isoformat(), douban="douban-m1"),
                recent_movie,
                series_episode,
                hot_restoration,
            ],
            "movies": [recent_movie],
            "series": [series_episode],
            "hot": [hot_restoration],
        },
        metadata_by_key={
            "douban-m1": metadata(title="Unique Latest", year="2026"),
            "douban-m2": metadata(title="Recent Film", year="2025"),
            "douban-s2": metadata(title="Weekly Show", year="2026", intro="英国 | 英语 | 剧情"),
            "douban-h1": metadata(title="Classic Film", year="1988"),
        },
        now=now,
        items_per_rail=8,
    )

    assert "s2" in [item["id"] for item in rail_items(response, "western_series")]
    assert "m2" in [item["id"] for item in rail_items(response, "foreign_movies")]
    classic_ids = [item["id"] for item in rail_items(response, "classic_restorations")]
    assert "h1" in classic_ids
    assert "m2" not in classic_ids
    assert "s2" not in classic_ids


def test_hot_restorations_fall_back_to_torrent_name_year_when_metadata_is_missing():
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    old_restoration = torrent_item(
        id="old",
        category=439,
        name="Battle Royale 2000 Director's Cut 2160p UHD Blu-ray REMUX",
        leechers=100,
        douban="douban-old",
    )
    new_release = torrent_item(
        id="new",
        category=439,
        name="Cold Storage 2026 2160p GER UHD Blu-ray DoVi HDR10 HEVC",
        leechers=200,
        douban="douban-new",
    )

    response = build_media_wall_rails(
        torrents_by_source={
            "latest": [],
            "movies": [],
            "series": [],
            "hot": [new_release, old_restoration],
        },
        metadata_by_key={},
        now=now,
        items_per_rail=8,
    )

    assert [item["id"] for item in rail_items(response, "classic_restorations")] == ["old"]


def test_media_wall_uses_imdb_photo_when_cover_url_is_missing():
    now = datetime.now(BEIJING_TZ)
    photo_url = "https://api.gateway996.com/api/media/redirect?zone=imdbv2img2"

    response = build_media_wall_rails(
        torrents_by_source={
            "latest": [],
            "movies": [],
            "series": [],
            "hot": [
                torrent_item(
                    id="imdb-only",
                    category=419,
                    name="Star Trek 2009 UHD BluRay 2160p HEVC TrueHD5.1-Dolala",
                    douban="",
                    imdb="https://www.imdb.com/title/tt0796366",
                    created=now.isoformat(),
                ),
            ],
        },
        metadata_by_key={
            "imdb:tt0796366": {
                "title": "Star Trek",
                "year": "2009",
                "photo": photo_url,
            },
        },
        now=now,
        items_per_rail=8,
    )

    assert rail_items(response, "classic_restorations")[0]["poster_url"] == photo_url


def test_media_wall_uses_torrent_image_list_when_metadata_has_no_poster():
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    poster_url = "https://img.example/shelby-oaks.webp"
    movie = torrent_item(
        id="image-list-poster",
        category=419,
        name="Shelby Oaks 2025 2160p HamiVideo WEB-DL H.264 DD 5.1-UBWEB",
        douban="douban-image-list",
        small_descr="美国 | 英语 | 恐怖",
    )
    movie["imageList"] = [poster_url]

    response = build_media_wall_rails(
        torrents_by_source={
            "latest": [movie],
            "movies": [movie],
            "series": [],
            "hot": [],
        },
        metadata_by_key={
            "douban-image-list": metadata(
                title="Shelby Oaks",
                year="2025",
                cover="",
                intro="美国 | 英语 | 恐怖",
            )
        },
        now=now,
        items_per_rail=8,
    )

    assert rail_items(response, "foreign_movies")[0]["poster_url"] == poster_url


def test_media_wall_dedupes_equivalent_douban_url_variants_within_a_rail():
    now = datetime.now(BEIJING_TZ)

    response = build_media_wall_rails(
        torrents_by_source={
            "latest": [
                torrent_item(
                    id="m1",
                    category=419,
                    name="I Love Maria 1988 UHD BluRay 2160p HEVC",
                    douban="https://www.douban.com/subject/1304465/",
                    created=now.isoformat(),
                ),
                torrent_item(
                    id="m2",
                    category=419,
                    name="I Love Maria 1988 BluRay 1080p AVC",
                    douban="https://movie.douban.com/subject/1304465/",
                    created=now.isoformat(),
                ),
            ],
            "movies": [],
            "series": [],
            "hot": [],
        },
        metadata_by_key={
            "https://www.douban.com/subject/1304465/": metadata(title="I Love Maria", year="1988"),
        },
        now=now,
        items_per_rail=8,
    )

    assert [item["id"] for item in rail_items(response, "classic_restorations")] == ["m1"]



def test_media_wall_dedupes_after_ranking_so_best_duplicate_wins():
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    lower_quality = torrent_item(
        id="lower-quality",
        category=439,
        name="I Love Maria 1988 2160p WEB-DL H.265",
        douban="https://www.douban.com/subject/1304465/",
        created=now.isoformat(),
    )
    higher_quality = torrent_item(
        id="higher-quality",
        category=439,
        name="I Love Maria 1988 2160p UHD BluRay REMUX HEVC Atmos TrueHD",
        douban="https://movie.douban.com/subject/1304465/",
        created=(now - timedelta(days=1)).isoformat(),
    )

    response = build_media_wall_rails(
        torrents_by_source={
            "latest": [lower_quality, higher_quality],
            "movies": [],
            "series": [],
            "hot": [],
        },
        metadata_by_key={"1304465": metadata(title="I Love Maria", year="1988")},
        now=now,
        items_per_rail=8,
    )

    assert [item["id"] for item in rail_items(response, "classic_restorations")] == [
        "higher-quality"
    ]

def test_family_media_wall_excludes_tv_broadcast_without_episode_or_season_marker():
    now = datetime.now(BEIJING_TZ)

    response = build_media_wall_rails(
        torrents_by_source={
            "latest": [
                torrent_item(id="m1", category=419, created=now.isoformat(), douban="douban-m1"),
                torrent_item(
                    id="tv1",
                    category=402,
                    name="JSTV 2026 Yadea Modern Night 20260524 HDTV 1080i MP1 H.264-TPTV",
                    created=now.isoformat(),
                    douban="",
                    imdb="",
                ),
                torrent_item(
                    id="s1",
                    category=402,
                    name="Weekly Show S01E06 2160p WEB-DL H.265",
                    created=now.isoformat(),
                    douban="douban-s1",
                    small_descr="英国 | 剧情 | 第1季第6集",
                ),
            ],
            "movies": [],
            "series": [],
            "hot": [],
        },
        metadata_by_key={
            "douban-m1": metadata(title="Unique Latest", year="2026"),
            "douban-s1": metadata(title="Weekly Show", year="2026", intro="英国 | 剧情"),
        },
        now=now,
        items_per_rail=8,
    )

    item_ids = all_rail_item_ids(response)
    assert "tv1" not in item_ids
    assert {"m1", "s1"} <= item_ids


@pytest.mark.parametrize(
    ("name", "small_descr", "expected"),
    [
        (
            "The Tang Mist S01E05 1080p TX WEB-DL AAC2.0 H.264-MWeb",
            "大唐迷雾 | 2026 | 中国大陆 | 悬疑 古装 | 冯绍峰 邬君梅 | 第1季第5集",
            True,
        ),
        (
            "Jade.Come.Home.Love：Lo.And.Behold.Ep2814.HDTV.720p.H264-CNHK",
            "港劇: 愛．回家之開心速遞 (第2814集)[粤语][簡体字幕][劉丹/單立文/湯盈盈/呂慧儀 主演]",
            True,
        ),
        (
            "ZJTV-4K Unrivaled Chinese Music 2026 S01E01 2160p 50fps UHDTV AVS2.10bit HLG DD5.1-QHstudIo",
            "浙江卫视4K超高清频道 国乐无双 第01期【嘉宾：王栎鑫 | 梁汉文】QHstudIo小组录制作品",
            False,
        ),
        (
            "JSWS-4K Melody Roaming 2026 S03E06-E07 2160p 50fps UHDTV HEVC 10bit HLG DD5.1-QHstudIo",
            "江苏卫视4K超高清频道 音你而来 第三季 第6-7期【嘉宾：张碧晨】",
            False,
        ),
        (
            "Keep Running S10E14 1080p TX WEB-DL AAC2.0 H.264-MWeb",
            "奔跑吧 第十季 | 2026 | 中国大陆 | 真人秀 | 第10季第14集|第5期加更",
            False,
        ),
        (
            "Frieren: Beyond Journey's End S01E01 2160p WEB-DL",
            "葬送的芙莉莲 第1季 第01-28集 | 类型：动画 / 动作冒险 / 剧情",
            False,
        ),
        (
            "NBC News 2026 05 25 HDTV 1080p WEBRip H264 AAC-D0",
            "NBC News 新闻片段 2026.05.25 英语听力口语 / 雅思托福练习 / 自录",
            False,
        ),
    ],
)
def test_media_wall_series_candidate_filters_real_cache_patterns(name, small_descr, expected):
    assert (
        is_media_wall_series_candidate(
            {"category": 402, "name": name, "smallDescr": small_descr}
        )
        is expected
    )


@pytest.mark.parametrize(
    ("name", "small_descr", "expected"),
    [
        (
            "Sky Rise 2018 HDTV 1080i MP1 H.264-TPTV",
            "天慕 | 2018 | 中国大陆 | 剧情 | 王强 | 王挺 索朗卓嘎",
            True,
        ),
        (
            "Eason Chan FEAR and DREAMS Live 2023 2160p BluRay",
            "陈奕迅 FEAR and DREAMS 演唱会",
            False,
        ),
        (
            "CCTV-5 Game 3 NBA Eastern Conference Finals 20260524 HDTV",
            "CCTV-5 | 2025-2026赛季美国职业篮球联赛",
            False,
        ),
        (
            "Pinay Kamasutra 2026 1080p VMX WEB-DL AAC 2.0 H.264-KQRM",
            "Pinay Kamasutra 2026 | 国家： 菲律宾 | [他加禄语 - 音频] [英文字幕]",
            False,
        ),
    ],
)
def test_media_wall_movie_candidate_filters_non_movie_patterns(name, small_descr, expected):
    assert (
        is_media_wall_movie_candidate(
            {"category": 419, "name": name, "smallDescr": small_descr}
        )
        is expected
    )


def test_family_media_wall_excludes_non_scripted_tv_music_and_anime_items():
    now = datetime.now(BEIJING_TZ)

    response = build_media_wall_rails(
        torrents_by_source={
            "latest": [],
            "movies": [],
            "series": [
                torrent_item(
                    id="s1",
                    category=402,
                    name="The Tang Mist S01E05 2160p TX WEB-DL AAC2.0 H.265-MWeb",
                    douban="douban-s1",
                ),
                torrent_item(
                    id="zjtv",
                    category=402,
                    name="ZJTV-4K Unrivaled Chinese Music 2026 S01E01 2160p 50fps UHDTV AVS2.10bit HLG DD5.1-QHstudIo",
                    douban="",
                    imdb="",
                    small_descr="浙江卫视4K超高清频道 国乐无双 第01期【嘉宾：王栎鑫】",
                ),
                torrent_item(
                    id="frieren",
                    category=402,
                    name="Frieren: Beyond Journey's End S01E01 2160p WEB-DL",
                    douban="",
                    imdb="",
                    small_descr="葬送的芙莉莲 第1季 第01-28集 | 类型：动画 / 动作冒险 / 剧情",
                ),
            ],
            "hot": [],
        },
        metadata_by_key={
            "douban-s1": metadata(
                title="The Tang Mist",
                year="2026",
                intro="大唐迷雾 | 中国大陆 | 悬疑 古装 | 第1季第5集",
            ),
            "torrent:zjtv": metadata(
                title="ZJTV-4K Unrivaled Chinese Music",
                intro="浙江卫视4K超高清频道 国乐无双 第01期【嘉宾：王栎鑫】",
            ),
            "torrent:frieren": metadata(
                title="Frieren",
                intro="类型：动画 / 动作冒险 / 剧情",
            ),
        },
        now=now,
        items_per_rail=8,
    )

    assert [item["id"] for item in rail_items(response, "chinese_series")] == ["s1"]
    assert "zjtv" not in all_rail_item_ids(response)
    assert "frieren" not in all_rail_item_ids(response)


def test_series_rail_excludes_old_complete_season_packs_but_keeps_current_updates():
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)

    response = build_media_wall_rails(
        torrents_by_source={
            "latest": [],
            "movies": [],
            "series": [
                torrent_item(
                    id="episode",
                    category=402,
                    name="The Scarecrow S01E11 2160p friDay WEB-DL AAC2.0 H.265-MWeb",
                    douban="douban-episode",
                ),
                torrent_item(
                    id="current-season",
                    category=402,
                    name="Made with Love S01 2026 Complete 2160p Netflix WEB-DL H.265 DDP 5.1 Atmos-DBTV",
                    douban="douban-current",
                ),
                torrent_item(
                    id="recent-completed-season",
                    category=402,
                    name="Brassic S06 2024 Complete 2160p NOW WEB-DL H.265 DDP 5.1 Atmos-DBTV",
                    created=(now - timedelta(days=20)).isoformat(),
                    douban="douban-recent-completed-season",
                ),
                torrent_item(
                    id="old-imdb-season",
                    category=402,
                    name="Another Life S01 2019 Complete 2160p Netflix WEB-DL H.265 DDP 5.1 Atmos-DBTV",
                    douban="",
                    imdb="https://www.imdb.com/title/tt8369840/",
                ),
                torrent_item(
                    id="old-douban-season",
                    category=402,
                    name="Columbo S09 1989 2160p BluRay x265 DD 2.0-ADE",
                    douban="douban-columbo",
                ),
                torrent_item(
                    id="previous-old-season",
                    category=402,
                    name="The Five Juanas S01 2021 Complete 2160p Netflix WEB-DL H.265 DDP 5.1-DBTV",
                    douban="",
                    imdb="https://www.imdb.com/title/tt15377930/",
                ),
            ],
            "hot": [],
        },
        metadata_by_key={
            "douban-episode": metadata(title="The Scarecrow", year="2026", intro="美国 | 英语 | 剧情"),
            "douban-current": metadata(title="Made with Love", year="2026", intro="美国 | 英语 | 剧情"),
            "douban-recent-completed-season": metadata(
                title="Brassic",
                year="2024",
                intro="英国 | 英语 | 剧情",
            ),
            "imdb:tt8369840": metadata(title="Another Life", year="2019", intro="加拿大 | 英语 | 剧情"),
            "douban-columbo": metadata(title="Columbo", year="1989", intro="美国 | 英语 | 剧情"),
            "imdb:tt15377930": metadata(title="The Five Juanas", year="2021", intro="墨西哥 | 西班牙语 | 剧情"),
        },
        now=now,
        items_per_rail=12,
    )

    assert {item["id"] for item in rail_items(response, "western_series")} == {
        "episode",
        "current-season",
        "recent-completed-season",
    }
    assert "old-imdb-season" not in all_rail_item_ids(response)
    assert "old-douban-season" not in all_rail_item_ids(response)
    assert "previous-old-season" not in all_rail_item_ids(response)


class FakeResponse:
    def json(self):
        return {"code": "0", "message": "SUCCESS", "data": {"ok": True}}


class SlowFakeHttpClient:
    def __init__(self):
        self.active = 0
        self.max_active = 0
        self.calls = []

    async def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        self.active += 1
        self.max_active = max(self.max_active, self.active)
        await pytest.importorskip("asyncio").sleep(0.01)
        self.active -= 1
        return FakeResponse()


@pytest.mark.asyncio
async def test_mtclient_serializes_concurrent_mteam_requests(monkeypatch):
    fake_http = SlowFakeHttpClient()
    monkeypatch.setattr(mteam_api, "MT_TOKEN", "token")

    async def fake_get_http_client():
        return fake_http

    monkeypatch.setattr(mteam_api, "get_http_client", fake_get_http_client)
    client = MTClient(request_delay=0)

    await pytest.importorskip("asyncio").gather(
        client._request("https://api.example/a", json={}, label="a"),
        client._request("https://api.example/b", json={}, label="b"),
    )

    assert fake_http.max_active == 1
    assert len(fake_http.calls) == 2


@pytest.mark.asyncio
async def test_mtclient_waits_between_sequential_mteam_requests(monkeypatch):
    fake_http = SlowFakeHttpClient()
    sleep_durations = []
    monkeypatch.setattr(mteam_api, "MT_TOKEN", "token")

    async def fake_get_http_client():
        return fake_http

    async def fake_sleep(duration):
        sleep_durations.append(duration)

    monkeypatch.setattr(mteam_api, "get_http_client", fake_get_http_client)
    client = MTClient(request_delay=3, sleeper=fake_sleep, monotonic=lambda: 100.0)

    await client._request("https://api.example/a", json={}, label="a")
    await client._request("https://api.example/b", json={}, label="b")

    assert sleep_durations == [3]


class FakeMediaClient:
    def __init__(self, *, fail_search=False):
        self.fail_search = fail_search
        self.search_payloads = []
        self.metadata_calls = []

    async def search_torrents(self, payload, label=""):
        self.search_payloads.append((label, payload))
        if self.fail_search:
            raise RuntimeError("mteam unavailable")
        source = label.split(":")[-1]
        return {
            "data": [
                torrent_item(
                    id=f"{source}-1",
                    category=419 if source != "anime" else 405,
                    name=f"{source} Title 2026 2160p REMUX S01E05",
                    douban=f"douban-{source}",
                )
            ]
        }

    async def fetch_douban_media_info(self, code, refresh=False):
        self.metadata_calls.append(("douban", code, refresh))
        return metadata(title=f"Meta {code}", year="2026")

    async def fetch_imdb_media_info(self, code, refresh=False):
        self.metadata_calls.append(("imdb", code, refresh))
        return None


class ManyMediaClient(FakeMediaClient):
    async def search_torrents(self, payload, label=""):
        self.search_payloads.append((label, payload))
        source = label.split(":")[-1]
        return {
            "data": [
                torrent_item(
                    id=f"{source}-{index}",
                    category=419,
                    name=f"{source} Film {index} 2026 2160p BluRay",
                    douban=f"douban-{source}-{index}",
                    imdb="",
                )
                for index in range(5)
            ]
        }


def test_media_wall_staggered_scheduler_picks_one_missing_source_at_a_time(tmp_path):
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    service = MediaWallService(
        client=FakeMediaClient(),
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        refresh_interval_seconds=21600,
    )

    assert service._next_due_source(now) == "latest"

    service.snapshot = {
        "last_refreshed": now.isoformat(),
        "next_refresh": (now + timedelta(seconds=21600)).isoformat(),
        "stale": False,
        "refresh_status": "ok",
        "rails": [],
        "sources": {
            "latest": {"last_refreshed": now.isoformat(), "items": []},
        },
    }

    assert service._next_due_source(now + timedelta(seconds=1)) == "movies"


def test_media_wall_staggered_scheduler_keeps_refreshed_sources_on_their_own_due_times(tmp_path):
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    service = MediaWallService(
        client=FakeMediaClient(),
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        refresh_interval_seconds=21600,
    )
    stagger = service.source_stagger_seconds
    service.snapshot = {
        "last_refreshed": (now + timedelta(seconds=stagger * 3)).isoformat(),
        "next_refresh": (now + timedelta(seconds=21600)).isoformat(),
        "stale": False,
        "refresh_status": "ok",
        "rails": [],
        "sources": {
            "latest": {"last_refreshed": now.isoformat(), "items": []},
            "movies": {"last_refreshed": (now + timedelta(seconds=stagger)).isoformat(), "items": []},
            "series": {"last_refreshed": (now + timedelta(seconds=stagger * 2)).isoformat(), "items": []},
            "hot": {"last_refreshed": (now + timedelta(seconds=stagger * 3)).isoformat(), "items": []},
        },
    }

    assert service._next_due_source(now + timedelta(seconds=21600, minutes=1)) == "latest"

    service.snapshot["sources"]["latest"]["last_refreshed"] = (
        now + timedelta(seconds=21600, minutes=1)
    ).isoformat()

    assert service._next_due_source(now + timedelta(seconds=21600 + stagger, minutes=1)) == "movies"


@pytest.mark.asyncio
async def test_media_wall_refresh_source_once_fetches_only_one_source(tmp_path):
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    client = FakeMediaClient()
    service = MediaWallService(
        client=client,
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        refresh_interval_seconds=21600,
        max_metadata_fetches=8,
    )

    snapshot = await service.refresh_source_once("latest", now=now)

    assert [label for label, _payload in client.search_payloads] == ["media-wall:latest"]
    assert snapshot["sources"]["latest"]["last_refreshed"] == now.isoformat()
    assert [rail["id"] for rail in snapshot["rails"]] == EXPECTED_HOME_RAIL_IDS


@pytest.mark.asyncio
async def test_media_wall_source_refresh_uses_fractional_metadata_budget(tmp_path):
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    client = ManyMediaClient()
    service = MediaWallService(
        client=client,
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        refresh_interval_seconds=21600,
        max_metadata_fetches=8,
    )

    await service.refresh_source_once("latest", now=now)

    assert len(client.metadata_calls) == 2


@pytest.mark.asyncio
async def test_media_wall_source_refresh_reports_next_staggered_source_time(tmp_path):
    base = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    client = FakeMediaClient()
    service = MediaWallService(
        client=client,
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        refresh_interval_seconds=21600,
        max_metadata_fetches=0,
    )
    stagger = service.source_stagger_seconds
    service.snapshot = {
        "last_refreshed": (base + timedelta(seconds=stagger * 3)).isoformat(),
        "next_refresh": (base + timedelta(seconds=21600)).isoformat(),
        "stale": False,
        "refresh_status": "ok",
        "rails": [],
        "sources": {
            "latest": {"last_refreshed": base.isoformat(), "items": []},
            "movies": {"last_refreshed": (base + timedelta(seconds=stagger)).isoformat(), "items": []},
            "series": {"last_refreshed": (base + timedelta(seconds=stagger * 2)).isoformat(), "items": []},
            "hot": {"last_refreshed": (base + timedelta(seconds=stagger * 3)).isoformat(), "items": []},
        },
    }
    now = base + timedelta(seconds=21600, minutes=1)

    snapshot = await service.refresh_source_once("latest", now=now)

    assert snapshot["next_refresh"] == (base + timedelta(seconds=21600 + stagger)).isoformat()


def test_media_wall_service_reports_due_only_after_refresh_interval(tmp_path):
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    service = MediaWallService(
        client=FakeMediaClient(),
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        refresh_interval_seconds=21600,
    )
    service.snapshot = {
        "last_refreshed": now.isoformat(),
        "next_refresh": (now + timedelta(seconds=21600)).isoformat(),
        "stale": False,
        "refresh_status": "ok",
        "rails": [],
    }

    assert service.should_refresh(now + timedelta(hours=5, minutes=59)) is False
    assert service.should_refresh(now + timedelta(hours=6, seconds=1)) is True


def test_media_wall_service_sanitizes_removed_anime_rail_from_cached_snapshot(tmp_path):
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    service = MediaWallService(
        client=FakeMediaClient(),
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        refresh_interval_seconds=21600,
    )
    service.snapshot = {
        "last_refreshed": now.isoformat(),
        "next_refresh": (now + timedelta(seconds=21600)).isoformat(),
        "stale": False,
        "refresh_status": "ok",
        "rails": [
            {
                "id": "western_series",
                "title": "英美剧更新",
                "description": "",
                "items": [
                    {
                        "id": "s1",
                        "media_type": "series",
                        "episode": "S01E01",
                        "torrent_name": "Slow Horses S01E01 2160p WEB-DL H.265",
                        "description": "英国 | 英语 | 剧情",
                    },
                    {"id": "a1", "media_type": "anime", "torrent_name": "Anime EP01 2160p HEVC"},
                ],
            },
            {"id": "anime_updates", "title": "动漫追番", "description": "", "items": []},
        ],
    }

    snapshot = service.get_snapshot(now)

    assert [rail["id"] for rail in snapshot["rails"]] == EXPECTED_HOME_RAIL_IDS
    assert [item["id"] for item in rail_items(snapshot, "western_series")] == ["s1"]
    assert all(
        not rail["items"]
        for rail in snapshot["rails"]
        if rail["id"] != "western_series"
    )


def test_media_wall_service_sanitizes_classic_duplicates_from_cached_snapshot(tmp_path):
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    service = MediaWallService(
        client=FakeMediaClient(),
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        refresh_interval_seconds=21600,
    )
    service.snapshot = {
        "last_refreshed": now.isoformat(),
        "next_refresh": (now + timedelta(seconds=21600)).isoformat(),
        "stale": False,
        "refresh_status": "ok",
        "rails": [
            {
                "id": "classic_restorations",
                "title": "经典补档 / 高质量收藏",
                "description": "",
                "items": [
                    {
                        "id": "h1",
                        "media_key": "douban:h1",
                        "media_type": "movie",
                        "year": "1988",
                        "torrent_name": "Classic Film 1988 2160p UHD BluRay REMUX HEVC",
                    },
                    {
                        "id": "h1-copy",
                        "media_key": "douban:h1",
                        "media_type": "movie",
                        "year": "1988",
                        "torrent_name": "Classic Film 1988 2160p UHD BluRay REMUX HEVC",
                    },
                ],
            },
        ],
    }

    snapshot = service.get_snapshot(now)

    assert [item["id"] for item in rail_items(snapshot, "classic_restorations")] == ["h1"]


def test_media_wall_service_sanitizes_latest_tv_broadcasts_from_cached_snapshot(tmp_path):
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    service = MediaWallService(
        client=FakeMediaClient(),
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        refresh_interval_seconds=21600,
    )
    service.snapshot = {
        "last_refreshed": now.isoformat(),
        "next_refresh": (now + timedelta(seconds=21600)).isoformat(),
        "stale": False,
        "refresh_status": "ok",
        "rails": [
            {
                "id": "western_series",
                "title": "英美剧更新",
                "description": "",
                "items": [
                    {
                        "id": "tv1",
                        "media_key": "title:jstv",
                        "media_type": "series",
                        "episode": None,
                        "torrent_name": "JSTV 2026 Yadea Modern Night 20260524 HDTV 2160p H.265",
                        "description": "江苏卫视4K超高清频道 晚会",
                    },
                    {
                        "id": "s1",
                        "media_key": "douban:s1",
                        "media_type": "series",
                        "episode": "S01E06",
                        "torrent_name": "Weekly Show S01E06 2160p WEB-DL H.265",
                        "description": "英国 | 英语 | 剧情",
                    },
                ],
            },
        ],
    }

    snapshot = service.get_snapshot(now)

    assert [item["id"] for item in rail_items(snapshot, "western_series")] == ["s1"]


def test_media_wall_service_keeps_cached_series_rail_items_without_region_text(tmp_path):
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    service = MediaWallService(
        client=FakeMediaClient(),
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        refresh_interval_seconds=21600,
    )
    service.snapshot = {
        "last_refreshed": now.isoformat(),
        "next_refresh": (now + timedelta(seconds=21600)).isoformat(),
        "stale": False,
        "refresh_status": "ok",
        "rails": [
            {
                "id": "western_series",
                "title": "英美剧更新",
                "description": "",
                "items": [
                    {
                        "id": "fallout",
                        "media_key": "douban:fallout",
                        "media_type": "series",
                        "episode": "S02",
                        "year": "2025",
                        "torrent_name": "Fallout S02 UHD BluRay 2160p HEVC Atmos TrueHD7.1-MTeam",
                        "quality_tags": ["4K", "2160p", "BluRay", "H.265", "Atmos"],
                        "description": "第二季将延续第一季结局的故事，带领观众穿越莫哈韦荒原。",
                    }
                ],
            }
        ],
    }

    snapshot = service.get_snapshot(now)

    assert [item["id"] for item in rail_items(snapshot, "western_series")] == ["fallout"]


def test_media_wall_service_sanitizes_non_scripted_series_from_cached_snapshot(tmp_path):
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    service = MediaWallService(
        client=FakeMediaClient(),
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        refresh_interval_seconds=21600,
    )
    service.snapshot = {
        "last_refreshed": now.isoformat(),
        "next_refresh": (now + timedelta(seconds=21600)).isoformat(),
        "stale": False,
        "refresh_status": "ok",
        "rails": [
            {
                "id": "chinese_series",
                "title": "华语剧集",
                "description": "",
                "items": [
                    {
                        "id": "s1",
                        "media_key": "douban:s1",
                        "media_type": "series",
                        "episode": "S01E05",
                        "torrent_name": "The Tang Mist S01E05 2160p WEB-DL H.265",
                        "description": "大唐迷雾 | 中国大陆 | 悬疑 古装 | 第1季第5集",
                    },
                    {
                        "id": "zjtv",
                        "media_key": "title:zjtv",
                        "media_type": "series",
                        "episode": "S01E01",
                        "torrent_name": "ZJTV-4K Unrivaled Chinese Music 2026 S01E01 2160p 50fps UHDTV",
                        "description": "浙江卫视4K超高清频道 国乐无双 第01期【嘉宾：王栎鑫】",
                    },
                ],
            },
        ],
    }

    snapshot = service.get_snapshot(now)

    assert [item["id"] for item in rail_items(snapshot, "chinese_series")] == ["s1"]


def test_media_wall_service_sanitizes_non_movie_items_from_cached_snapshot(tmp_path):
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    service = MediaWallService(
        client=FakeMediaClient(),
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        refresh_interval_seconds=21600,
    )
    service.snapshot = {
        "last_refreshed": now.isoformat(),
        "next_refresh": (now + timedelta(seconds=21600)).isoformat(),
        "stale": False,
        "refresh_status": "ok",
        "rails": [
            {
                "id": "foreign_movies",
                "title": "近期外语电影",
                "description": "",
                "items": [
                    {
                        "id": "m1",
                        "media_key": "douban:m1",
                        "media_type": "movie",
                        "year": "2026",
                        "torrent_name": "Cold Storage 2026 2160p UHD BluRay HEVC",
                        "description": "美国 | 英语 | 惊悚",
                    },
                    {
                        "id": "concert",
                        "media_key": "title:eason",
                        "media_type": "movie",
                        "torrent_name": "Eason Chan FEAR and DREAMS Live 2023 2160p BluRay",
                        "description": "陈奕迅 FEAR and DREAMS 演唱会",
                    },
                ],
            },
        ],
    }

    snapshot = service.get_snapshot(now)

    assert [item["id"] for item in rail_items(snapshot, "foreign_movies")] == ["m1"]


def test_extract_douban_poster_url_reads_open_graph_and_json_ld_images():
    from app.services import media_wall as media_wall_module

    assert (
        media_wall_module.extract_douban_poster_url(
            """
            <html><head>
              <meta property="og:image" content="https://img1.doubanio.com/view/photo/l/public/p123.webp" />
            </head></html>
            """
        )
        == "https://img1.doubanio.com/view/photo/l/public/p123.webp"
    )
    assert (
        media_wall_module.extract_douban_poster_url(
            """
            <script type="application/ld+json">
              {"@type":"Movie","image":["https:\\/\\/img2.doubanio.com\\/view\\/photo\\/l\\/public\\/p456.jpg"]}
            </script>
            """
        )
        == "https://img2.doubanio.com/view/photo/l/public/p456.jpg"
    )


@pytest.mark.asyncio
async def test_media_wall_metadata_fetch_uses_douban_page_poster_fallback_sparingly(
    monkeypatch,
    tmp_path,
):
    from app.services import media_wall as media_wall_module

    class NoPosterClient(FakeMediaClient):
        async def fetch_douban_media_info(self, code, refresh=False):
            self.metadata_calls.append(("douban", code, refresh))
            return metadata(title=f"Meta {code}", year="2026", cover=None)

    poster_calls = []

    async def fake_fetch_douban_poster(code):
        poster_calls.append(code)
        return f"https://img.doubanio.com/view/photo/l/public/p{code}.webp"

    monkeypatch.setattr(
        media_wall_module,
        "fetch_douban_poster_from_page",
        fake_fetch_douban_poster,
        raising=False,
    )

    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    service = MediaWallService(
        client=NoPosterClient(),
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        max_metadata_fetches=2,
    )
    service.max_douban_poster_fetches = 1

    result = await service._metadata_for_torrents(
        {
            "latest": [
                torrent_item(
                    id="m1",
                    douban="https://movie.douban.com/subject/1234567/",
                    imdb="",
                ),
                torrent_item(
                    id="m2",
                    douban="https://movie.douban.com/subject/7654321/",
                    imdb="",
                ),
            ]
        },
        now,
        max_fetches=2,
    )

    assert poster_calls == ["1234567"]
    assert result["https://movie.douban.com/subject/1234567/"]["coverUrl"] == (
        "https://img.doubanio.com/view/photo/l/public/p1234567.webp"
    )
    assert result["https://movie.douban.com/subject/7654321/"]["coverUrl"] is None
    assert service.metadata_cache["douban:1234567"][
        "douban_poster_attempted_at"
    ] == now.isoformat()


def test_media_wall_service_sanitizes_cached_douban_url_variant_duplicates(tmp_path):
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    service = MediaWallService(
        client=FakeMediaClient(),
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        refresh_interval_seconds=21600,
    )
    service.snapshot = {
        "last_refreshed": now.isoformat(),
        "next_refresh": (now + timedelta(seconds=21600)).isoformat(),
        "stale": False,
        "refresh_status": "ok",
        "rails": [
            {
                "id": "classic_restorations",
                "title": "经典补档 / 高质量收藏",
                "description": "",
                "items": [
                    {
                        "id": "m1",
                        "media_key": "douban:https://www.douban.com/subject/1304465/",
                        "media_type": "movie",
                        "torrent_name": "I Love Maria 1988 UHD BluRay 2160p HEVC",
                    },
                    {
                        "id": "m2",
                        "media_key": "douban:https://movie.douban.com/subject/1304465/",
                        "media_type": "movie",
                        "torrent_name": "I Love Maria 1988 BluRay 1080p AVC",
                    },
                ],
            },
        ],
    }

    snapshot = service.get_snapshot(now)

    assert [item["id"] for item in rail_items(snapshot, "classic_restorations")] == ["m1"]


@pytest.mark.asyncio
async def test_media_wall_service_refreshes_and_persists_snapshot(tmp_path):
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    client = FakeMediaClient()
    service = MediaWallService(
        client=client,
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        refresh_interval_seconds=21600,
        max_metadata_fetches=10,
    )

    snapshot = await service.refresh_once(now=now)

    assert snapshot["last_refreshed"] == now.isoformat()
    assert snapshot["next_refresh"] == (now + timedelta(seconds=21600)).isoformat()
    assert snapshot["refresh_status"] == "ok"
    assert snapshot["stale"] is False
    assert [rail["id"] for rail in snapshot["rails"]] == EXPECTED_HOME_RAIL_IDS
    assert all(label != "media-wall:anime" for label, _payload in client.search_payloads)
    assert client.search_payloads
    assert client.metadata_calls
    assert (tmp_path / "snapshot.json").exists()
    assert (tmp_path / "metadata.json").exists()


@pytest.mark.asyncio
async def test_media_wall_metadata_fetch_normalizes_douban_subject_urls(tmp_path):
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    client = FakeMediaClient()
    service = MediaWallService(
        client=client,
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        max_metadata_fetches=1,
    )

    await service._metadata_for_torrents(
        {
            "latest": [
                torrent_item(
                    douban="https://movie.douban.com/subject/1234567/",
                    imdb="https://www.imdb.com/title/tt7654321/",
                )
            ]
        },
        now,
    )

    assert client.metadata_calls[0] == ("douban", "1234567", False)


@pytest.mark.asyncio
async def test_media_wall_metadata_empty_fetch_is_cached_until_miss_ttl_and_cleared_on_success(
    tmp_path,
):
    class MissThenHitClient(FakeMediaClient):
        def __init__(self):
            super().__init__()
            self.responses = [
                None,
                metadata(title="Recovered Title", year="2026"),
            ]

        async def fetch_douban_media_info(self, code, refresh=False):
            self.metadata_calls.append(("douban", code, refresh))
            return self.responses.pop(0)

    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    client = MissThenHitClient()
    service = MediaWallService(
        client=client,
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        max_metadata_fetches=1,
        metadata_miss_ttl_seconds=3600,
    )
    service.max_douban_poster_fetches = 0
    torrents_by_source = {
        "latest": [
            torrent_item(
                douban="https://movie.douban.com/subject/1234567/",
                imdb="",
            )
        ]
    }

    first_result = await service._metadata_for_torrents(torrents_by_source, now)

    assert first_result == {}
    assert client.metadata_calls == [("douban", "1234567", False)]
    assert service.metadata_cache["douban:1234567"]["missed_at"] == now.isoformat()

    second_result = await service._metadata_for_torrents(
        torrents_by_source,
        now + timedelta(minutes=30),
    )

    assert second_result == {}
    assert client.metadata_calls == [("douban", "1234567", False)]

    success_result = await service._metadata_for_torrents(
        torrents_by_source,
        now + timedelta(hours=2),
    )

    cache_entry = service.metadata_cache["douban:1234567"]
    assert client.metadata_calls == [
        ("douban", "1234567", False),
        ("douban", "1234567", False),
    ]
    assert "missed_at" not in cache_entry
    assert cache_entry["data"]["title"] == "Recovered Title"
    assert success_result["https://movie.douban.com/subject/1234567/"][
        "title"
    ] == "Recovered Title"


@pytest.mark.asyncio
async def test_media_wall_metadata_refetch_empty_keeps_stale_cached_metadata(tmp_path):
    class EmptyRefetchClient(FakeMediaClient):
        async def fetch_douban_media_info(self, code, refresh=False):
            self.metadata_calls.append(("douban", code, refresh))
            return None

    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    cached = metadata(title="Cached Title", year="2026")
    service = MediaWallService(
        client=EmptyRefetchClient(),
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        max_metadata_fetches=1,
    )
    service.max_douban_poster_fetches = 0
    service.metadata_cache = {
        "douban:1234567": {
            "fetched_at": (now - timedelta(days=60)).isoformat(),
            "data": cached,
        }
    }

    result = await service._metadata_for_torrents(
        {
            "latest": [
                torrent_item(
                    douban="https://movie.douban.com/subject/1234567/",
                    imdb="",
                )
            ]
        },
        now,
    )

    assert service.client.metadata_calls == [("douban", "1234567", False)]
    assert result["https://movie.douban.com/subject/1234567/"]["title"] == "Cached Title"
    assert service.metadata_cache["douban:1234567"]["data"] == cached
    assert service.metadata_cache["douban:1234567"]["missed_at"] == now.isoformat()


@pytest.mark.asyncio
async def test_media_wall_metadata_cache_reuses_normalized_douban_and_imdb_variants(tmp_path):
    class VariantMetadataClient(FakeMediaClient):
        async def fetch_imdb_media_info(self, code, refresh=False):
            self.metadata_calls.append(("imdb", code, refresh))
            return metadata(title=f"IMDb {code}", year="2009")

    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    client = VariantMetadataClient()
    service = MediaWallService(
        client=client,
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        max_metadata_fetches=10,
    )
    service.max_douban_poster_fetches = 0

    result = await service._metadata_for_torrents(
        {
            "latest": [
                torrent_item(
                    id="douban-a",
                    douban="https://movie.douban.com/subject/1234567/",
                    imdb="",
                ),
                torrent_item(
                    id="douban-b",
                    douban="https://www.douban.com/subject/1234567/",
                    imdb="",
                ),
                torrent_item(
                    id="imdb-a",
                    douban="",
                    imdb="https://www.imdb.com/title/tt7654321/",
                ),
                torrent_item(
                    id="imdb-b",
                    douban="",
                    imdb="TT7654321",
                ),
            ]
        },
        now,
    )

    assert client.metadata_calls == [
        ("douban", "1234567", False),
        ("imdb", "tt7654321", False),
    ]
    assert "douban:1234567" in service.metadata_cache
    assert "imdb:tt7654321" in service.metadata_cache
    assert result["https://www.douban.com/subject/1234567/"]["title"] == "Meta 1234567"
    assert result["TT7654321"]["title"] == "IMDb tt7654321"


@pytest.mark.asyncio
async def test_media_wall_metadata_flattening_ignores_malformed_source_rows(tmp_path):
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    client = FakeMediaClient()
    service = MediaWallService(
        client=client,
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        max_metadata_fetches=1,
    )

    result = await service._metadata_for_torrents(
        {
            "latest": [
                None,
                "malformed",
                torrent_item(id="valid", douban="douban-valid", imdb=""),
            ]
        },
        now,
    )

    assert client.metadata_calls == [("douban", "douban-valid", False)]
    assert result["douban-valid"]["title"] == "Meta douban-valid"


@pytest.mark.asyncio
async def test_media_wall_source_refresh_filters_malformed_rows_before_snapshot_storage(tmp_path):
    class MalformedRowsClient(FakeMediaClient):
        async def search_torrents(self, payload, label=""):
            self.search_payloads.append((label, payload))
            source = label.split(":")[-1]
            return {
                "data": [
                    None,
                    "malformed",
                    torrent_item(
                        id=f"{source}-valid",
                        category=419,
                        name=f"{source} Film 2026 2160p BluRay",
                        douban=f"douban-{source}",
                        imdb="",
                    ),
                ]
            }

    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    service = MediaWallService(
        client=MalformedRowsClient(),
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        max_metadata_fetches=1,
    )

    snapshot = await service.refresh_source_once("latest", now=now)

    assert snapshot["refresh_status"] == "ok"
    assert [item["id"] for item in snapshot["sources"]["latest"]["items"]] == ["latest-valid"]
    assert all(isinstance(item, dict) for item in snapshot["sources"]["latest"]["items"])

@pytest.mark.asyncio
async def test_media_wall_metadata_fetch_budget_is_spread_across_home_sources(tmp_path):
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    client = FakeMediaClient()
    service = MediaWallService(
        client=client,
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        max_metadata_fetches=4,
    )

    torrents_by_source = {
        source: [
            torrent_item(
                id=f"{source}-{index}",
                category=419,
                name=f"{source} Film {index} 2026 2160p BluRay",
                douban=f"douban-{source}-{index}",
                imdb="",
            )
            for index in range(5)
        ]
        for source in ("latest", "movies", "series", "hot")
    }

    await service._metadata_for_torrents(torrents_by_source, now)

    fetched_codes = [code for source_type, code, _refresh in client.metadata_calls if source_type == "douban"]
    assert fetched_codes == [
        "douban-latest-0",
        "douban-movies-0",
        "douban-series-0",
        "douban-hot-0",
    ]


@pytest.mark.asyncio
async def test_media_wall_service_keeps_previous_snapshot_when_refresh_fails(tmp_path):
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    previous = {
        "last_refreshed": (now - timedelta(hours=1)).isoformat(),
        "next_refresh": (now + timedelta(hours=5)).isoformat(),
        "stale": False,
        "refresh_status": "ok",
        "rails": [{"id": "latest", "title": "今日新发布", "description": "", "items": []}],
    }
    service = MediaWallService(
        client=FakeMediaClient(fail_search=True),
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        refresh_interval_seconds=21600,
    )
    service.snapshot = previous

    snapshot = await service.refresh_once(now=now)
    backoff_until = now + timedelta(seconds=1800)

    assert snapshot["rails"] == previous["rails"]
    assert snapshot["refresh_status"] == "error"
    assert snapshot["stale"] is True
    assert "mteam unavailable" in snapshot["last_error"]
    assert snapshot["next_refresh"] == backoff_until.isoformat()
    assert snapshot["refresh_backoff_until"] == backoff_until.isoformat()
    assert "mteam unavailable" in snapshot["refresh_backoff_reason"]



class InvalidPayloadClient(FakeMediaClient):
    async def search_torrents(self, payload, label=""):
        self.search_payloads.append((label, payload))
        return {"message": "ok"}


@pytest.mark.asyncio
async def test_media_wall_source_refresh_preserves_previous_source_on_invalid_payload(tmp_path):
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    previous_item = torrent_item(id="cached-latest", douban="douban-cached", imdb="")
    service = MediaWallService(
        client=InvalidPayloadClient(),
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        refresh_interval_seconds=21600,
    )
    service.snapshot = {
        "last_refreshed": (now - timedelta(hours=1)).isoformat(),
        "next_refresh": (now + timedelta(hours=5)).isoformat(),
        "stale": False,
        "refresh_status": "ok",
        "last_error": None,
        "rails": [],
        "sources": {
            "latest": {"last_refreshed": (now - timedelta(hours=1)).isoformat(), "items": [previous_item]},
            "movies": {"last_refreshed": (now - timedelta(hours=1)).isoformat(), "items": []},
        },
    }

    snapshot = await service.refresh_source_once("latest", now=now)

    assert snapshot["refresh_status"] == "error"
    assert snapshot["stale"] is True
    assert "invalid search payload" in snapshot["last_error"]
    assert snapshot["sources"]["latest"]["items"] == [previous_item]



@pytest.mark.asyncio
async def test_media_wall_source_refresh_failure_preserves_cached_wall_and_sets_backoff(tmp_path):
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    previous_item = torrent_item(id="cached-latest", douban="douban-cached", imdb="")
    cached_rails = [
        {
            "id": "quality_latest",
            "title": "高质量新片新剧",
            "description": "",
            "items": [{"id": "cached-card", "title": "Cached Card"}],
        }
    ]
    service = MediaWallService(
        client=InvalidPayloadClient(),
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        refresh_interval_seconds=21600,
        refresh_failure_backoff_seconds=1800,
    )
    service.snapshot = {
        "last_refreshed": (now - timedelta(hours=1)).isoformat(),
        "next_refresh": (now + timedelta(hours=5)).isoformat(),
        "stale": False,
        "refresh_status": "ok",
        "last_error": None,
        "rails": cached_rails,
        "sources": {
            "latest": {"last_refreshed": (now - timedelta(hours=1)).isoformat(), "items": [previous_item]},
        },
    }

    snapshot = await service.refresh_source_once("latest", now=now)
    backoff_until = now + timedelta(seconds=1800)

    assert snapshot["rails"] == cached_rails
    assert snapshot["sources"]["latest"]["items"] == [previous_item]
    assert snapshot["refresh_status"] == "error"
    assert snapshot["stale"] is True
    assert snapshot["next_refresh"] == backoff_until.isoformat()
    assert snapshot["refresh_backoff_until"] == backoff_until.isoformat()
    assert "invalid search payload" in snapshot["refresh_backoff_reason"]


@pytest.mark.asyncio
async def test_media_wall_refresh_during_active_backoff_does_not_search_mteam(tmp_path):
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    backoff_until = now + timedelta(minutes=30)
    client = FakeMediaClient()
    cached_rails = [
        {
            "id": "quality_latest",
            "title": "高质量新片新剧",
            "description": "",
            "items": [{"id": "cached-card", "title": "Cached Card"}],
        }
    ]
    service = MediaWallService(
        client=client,
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
    )
    service.snapshot = {
        "last_refreshed": (now - timedelta(hours=1)).isoformat(),
        "next_refresh": backoff_until.isoformat(),
        "stale": True,
        "refresh_status": "error",
        "last_error": "rate limited",
        "refresh_backoff_until": backoff_until.isoformat(),
        "refresh_backoff_reason": "rate limited",
        "rails": cached_rails,
        "sources": {"latest": {"last_refreshed": (now - timedelta(hours=1)).isoformat(), "items": []}},
    }

    source_snapshot = await service.refresh_source_once("latest", now=now)
    full_snapshot = await service.refresh_once(now=now)

    assert client.search_payloads == []
    assert source_snapshot["rails"] == cached_rails
    assert full_snapshot["rails"] == cached_rails
    assert source_snapshot["next_refresh"] == backoff_until.isoformat()
    assert full_snapshot["next_refresh"] == backoff_until.isoformat()
    assert source_snapshot["stale"] is True
    assert full_snapshot["stale"] is True


@pytest.mark.asyncio
async def test_media_wall_successful_source_refresh_clears_backoff_metadata(tmp_path):
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    client = FakeMediaClient()
    service = MediaWallService(
        client=client,
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        max_metadata_fetches=0,
    )
    service.snapshot = {
        "last_refreshed": (now - timedelta(hours=1)).isoformat(),
        "next_refresh": (now - timedelta(minutes=1)).isoformat(),
        "stale": True,
        "refresh_status": "error",
        "last_error": "rate limited",
        "refresh_backoff_until": (now - timedelta(minutes=1)).isoformat(),
        "refresh_backoff_reason": "rate limited",
        "rails": [],
        "sources": {},
    }

    snapshot = await service.refresh_source_once("latest", now=now)

    assert [label for label, _payload in client.search_payloads] == ["media-wall:latest"]
    assert snapshot["refresh_status"] == "ok"
    assert snapshot["last_error"] is None
    assert "refresh_backoff_until" not in snapshot
    assert "refresh_backoff_reason" not in snapshot


def test_media_wall_scheduler_waits_for_active_backoff_before_due_sources(tmp_path):
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    backoff_until = now + timedelta(minutes=15)
    service = MediaWallService(
        client=FakeMediaClient(),
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        refresh_interval_seconds=21600,
        source_stagger_seconds=60,
    )
    service.snapshot = {
        "last_refreshed": (now - timedelta(hours=7)).isoformat(),
        "next_refresh": backoff_until.isoformat(),
        "stale": True,
        "refresh_status": "error",
        "last_error": "rate limited",
        "refresh_backoff_until": backoff_until.isoformat(),
        "refresh_backoff_reason": "rate limited",
        "rails": [],
        "sources": {
            source: {"last_refreshed": (now - timedelta(hours=7)).isoformat(), "items": []}
            for source in ("latest", "movies", "series", "hot")
        },
    }

    assert service._next_due_source(now) is None
    assert service._seconds_until_next_due(now) == 900

def test_media_wall_service_maps_legacy_cached_items_into_fallback_rails(tmp_path):
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    service = MediaWallService(
        client=FakeMediaClient(),
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        refresh_interval_seconds=21600,
    )
    service.snapshot = {
        "last_refreshed": now.isoformat(),
        "next_refresh": (now + timedelta(seconds=21600)).isoformat(),
        "stale": False,
        "refresh_status": "ok",
        "rails": [
            {
                "id": "latest",
                "title": "今日新发布",
                "description": "",
                "items": [
                    {
                        "id": "legacy-movie",
                        "media_key": "douban:legacy-movie",
                        "media_type": "movie",
                        "year": "2026",
                        "torrent_name": "Legacy Film 2026 1080p BluRay H.264",
                        "quality_tags": ["1080p", "BluRay", "H.264"],
                        "created_date": now.isoformat(),
                    }
                ],
            }
        ],
    }

    snapshot = service.get_snapshot(now)

    assert [rail["id"] for rail in snapshot["rails"]] == EXPECTED_HOME_RAIL_IDS
    assert [item["id"] for item in rail_items(snapshot, "quality_latest")] == ["legacy-movie"]
    assert not rail_items(snapshot, "popular_media")


def test_media_wall_service_reports_cached_fallback_1080p_as_fallback(tmp_path):
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    service = MediaWallService(
        client=FakeMediaClient(),
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        refresh_interval_seconds=21600,
    )
    service.snapshot = {
        "last_refreshed": now.isoformat(),
        "next_refresh": (now + timedelta(seconds=21600)).isoformat(),
        "stale": False,
        "refresh_status": "ok",
        "rails": [
            {
                "id": "quality_latest",
                "title": "高质量新片新剧",
                "description": "",
                "items": [
                    {
                        "id": "fallback-1080",
                        "media_key": "douban:fallback-1080",
                        "media_type": "movie",
                        "year": "2026",
                        "torrent_name": "Fallback Film 2026 1080p BluRay H.264",
                        "quality_tags": ["1080p", "BluRay", "H.264"],
                        "created_date": now.isoformat(),
                    }
                ],
            }
        ],
    }

    snapshot = service.get_snapshot(now)

    diagnostics = snapshot["diagnostics"]["rails"]["quality_latest"]
    assert [item["id"] for item in rail_items(snapshot, "quality_latest")] == ["fallback-1080"]
    assert diagnostics["fallback"] == 1
    assert diagnostics["relaxed"] == 0


def test_media_wall_service_reports_cached_boutique_1080p_fill_as_relaxed(tmp_path):
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    service = MediaWallService(
        client=FakeMediaClient(),
        snapshot_path=tmp_path / "snapshot.json",
        metadata_path=tmp_path / "metadata.json",
        refresh_interval_seconds=21600,
    )
    service.snapshot = {
        "last_refreshed": now.isoformat(),
        "next_refresh": (now + timedelta(seconds=21600)).isoformat(),
        "stale": False,
        "refresh_status": "ok",
        "rails": [
            {
                "id": "western_series",
                "title": "英美剧更新",
                "description": "",
                "items": [
                    {
                        "id": "boutique-1080",
                        "media_key": "douban:boutique-1080",
                        "media_type": "series",
                        "episode": "S01E01",
                        "year": "2026",
                        "torrent_name": "Boutique Show S01E01 1080p WEB-DL H.264",
                        "quality_tags": ["1080p", "WEB-DL", "H.264"],
                        "description": "英国 | 英语 | 剧情",
                        "created_date": now.isoformat(),
                    }
                ],
            }
        ],
    }

    snapshot = service.get_snapshot(now)

    diagnostics = snapshot["diagnostics"]["rails"]["western_series"]
    assert [item["id"] for item in rail_items(snapshot, "western_series")] == ["boutique-1080"]
    assert diagnostics["relaxed"] == 1
    assert diagnostics["fallback"] == 0


def test_boutique_series_rail_fills_sparse_strict_results_with_1080p_quality():
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    strict = torrent_item(
        id="strict-western",
        category=402,
        name="Slow Horses S05E01 2160p WEB-DL H.265",
        douban="douban-strict-western",
        small_descr="英国 | 英语 | 第5季第1集",
    )
    relaxed = [
        torrent_item(
            id=f"relaxed-western-{index}",
            category=402,
            name=f"Slow Horses S05E0{index + 2} 1080p WEB-DL H.264",
            douban=f"douban-relaxed-western-{index}",
            small_descr="英国 | 英语 | 第5季第2集",
        )
        for index in range(5)
    ]

    response = build_media_wall_rails(
        torrents_by_source={"latest": [strict, *relaxed], "movies": [], "series": [strict, *relaxed], "hot": []},
        metadata_by_key={
            "douban-strict-western": metadata(title="Slow Horses", year="2026", intro="英国 | 英语"),
            **{
                f"douban-relaxed-western-{index}": metadata(title="Slow Horses", year="2026", intro="英国 | 英语")
                for index in range(5)
            },
        },
        now=now,
        items_per_rail=8,
    )

    ids = [item["id"] for item in rail_items(response, "western_series")]
    assert ids[0] == "strict-western"
    assert len(ids) == 6
    assert response["diagnostics"]["rails"]["western_series"] == {"items": 6, "strict": 1, "relaxed": 5, "fallback": 0}


def test_series_region_classification_uses_country_id_fallbacks():
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    western = torrent_item(
        id="western-country",
        category=402,
        name="Country Show S01E01 2160p WEB-DL H.265",
        douban="douban-western-country",
        small_descr="剧情 | 第1季第1集",
    )
    western["countries"] = [4]
    asian = torrent_item(
        id="asian-country",
        category=402,
        name="Country Drama S01E01 2160p WEB-DL H.265",
        douban="douban-asian-country",
        small_descr="剧情 | 第1季第1集",
    )
    asian["countries"] = [5]
    chinese = torrent_item(
        id="chinese-country",
        category=402,
        name="Country Mystery S01E01 2160p WEB-DL H.265",
        douban="douban-chinese-country",
        small_descr="悬疑 | 第1季第1集",
    )
    chinese["countries"] = [1]

    response = build_media_wall_rails(
        torrents_by_source={"latest": [western, asian, chinese], "movies": [], "series": [western, asian, chinese], "hot": []},
        metadata_by_key={
            "douban-western-country": metadata(title="Country Show", year="2026", intro="剧情"),
            "douban-asian-country": metadata(title="Country Drama", year="2026", intro="剧情"),
            "douban-chinese-country": metadata(title="Country Mystery", year="2026", intro="悬疑"),
        },
        now=now,
        items_per_rail=8,
    )

    assert [item["id"] for item in rail_items(response, "western_series")] == ["western-country"]
    assert [item["id"] for item in rail_items(response, "asian_series")] == ["asian-country"]
    assert [item["id"] for item in rail_items(response, "chinese_series")] == ["chinese-country"]


def test_series_metadata_region_overrides_conflicting_torrent_country_ids():
    now = datetime(2026, 6, 5, 12, 0, tzinfo=BEIJING_TZ)
    western = torrent_item(
        id="western-metadata-override",
        category=402,
        name="Your Friends and Neighbors S02 2025 2160p ATVP WEB-DL DDP5.1 Atmos HDR H.265-HHWEB",
        douban="douban-western-override",
        small_descr="掩耳盗邻 / 你的朋友与邻居 第二季 | 第09集 | 4K HDR | 类型: 剧情/犯罪",
    )
    western["countries"] = ["2"]

    response = build_media_wall_rails(
        torrents_by_source={"latest": [western], "movies": [], "series": [western], "hot": []},
        metadata_by_key={
            "douban-western-override": {
                **metadata(
                    title="掩耳盗邻 第二季",
                    year="2026",
                    intro="一名金融巨擘突然痛失婚姻与事业。",
                ),
                "originalTitle": "Your Friends and Neighbors Season 2",
                "countries": ["美国"],
                "languages": ["英语"],
            }
        },
        now=now,
        items_per_rail=8,
    )

    assert [item["id"] for item in rail_items(response, "western_series")] == [
        "western-metadata-override"
    ]
    assert [item["id"] for item in rail_items(response, "chinese_series")] == []


def test_fallback_rails_populate_from_non_4k_quality_resources_without_duplicates():
    now = datetime(2026, 5, 26, 12, 0, tzinfo=BEIJING_TZ)
    quality_movie = torrent_item(
        id="quality-1080",
        category=419,
        name="Useful Film 2026 1080p BluRay H.264",
        douban="douban-quality-1080",
        small_descr="中国大陆 | 汉语 | 剧情",
        seeders=12,
        leechers=5,
        times_completed=2,
    )
    popular_movie = torrent_item(
        id="popular-1080",
        category=419,
        name="Popular Film 2024 1080p WEB-DL H.265",
        created=(now - timedelta(days=260)).isoformat(),
        douban="douban-popular-1080",
        small_descr="中国大陆 | 汉语 | 剧情",
        seeders=80,
        leechers=200,
        times_completed=300,
    )

    response = build_media_wall_rails(
        torrents_by_source={"latest": [quality_movie], "movies": [quality_movie], "series": [], "hot": [popular_movie, quality_movie]},
        metadata_by_key={
            "douban-quality-1080": metadata(title="Useful Film", year="2026", intro="中国大陆 | 汉语 | 剧情"),
            "douban-popular-1080": metadata(title="Popular Film", year="2024", intro="中国大陆 | 汉语 | 剧情"),
        },
        now=now,
        items_per_rail=8,
    )

    assert [item["id"] for item in rail_items(response, "quality_latest")] == ["quality-1080"]
    assert [item["id"] for item in rail_items(response, "popular_media")] == ["popular-1080"]
    assert "quality-1080" not in [item["id"] for item in rail_items(response, "popular_media")]
    assert response["diagnostics"]["sources"] == {"latest": 1, "movies": 1, "series": 0, "hot": 2}
    assert response["diagnostics"]["rails"]["quality_latest"]["fallback"] == 1

@pytest.mark.asyncio
async def test_home_media_wall_route_reads_cached_snapshot_without_refresh(monkeypatch):
    from app.routes import home

    class FakeService:
        def __init__(self):
            self.get_calls = 0
            self.refresh_calls = 0

        def get_snapshot(self):
            self.get_calls += 1
            return {
                "last_refreshed": None,
                "next_refresh": None,
                "stale": True,
                "refresh_status": "empty",
                "last_error": None,
                "rails": [],
            }

        async def refresh_once(self):
            self.refresh_calls += 1

    fake_service = FakeService()
    monkeypatch.setattr(home, "media_wall_service", fake_service)

    payload = await home.get_home_media_wall()

    assert payload["refresh_status"] == "empty"
    assert fake_service.get_calls == 1
    assert fake_service.refresh_calls == 0
