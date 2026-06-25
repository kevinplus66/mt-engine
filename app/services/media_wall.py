"""
Read-only Home media wall helpers.

The media wall is built from cached M-Team search results and metadata. This
module keeps pure transformation logic separate from network refresh code so
classification and card shaping can be tested without touching M-Team.
"""

import asyncio
from copy import deepcopy
from html import unescape
import json
import re
from math import ceil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Tuple
from urllib.parse import parse_qs, quote, urlparse

from app.config import (
    BEIJING_TZ,
    MEDIA_WALL_DOUBAN_POSTER_FETCHES,
    MEDIA_WALL_MAX_METADATA_FETCHES,
    MEDIA_WALL_METADATA_TTL,
    MEDIA_WALL_REFRESH_INTERVAL,
    MEDIA_WALL_REFRESH_FAILURE_BACKOFF_SECONDS,
    MEDIA_WALL_STARTUP_DELAY,
    MT_SITE_URL,
    USER_AGENT,
    logger,
)
from app.constants import RADAR_MOVIE_CATEGORY_IDS, RADAR_TVSHOW_CATEGORY_IDS
from app.services.http_client import get_http_client
from app.services.mteam_api import mt_client
from app.utils import format_size, _safe_int


MOVIE_CATEGORIES: Set[int] = set(RADAR_MOVIE_CATEGORY_IDS)
SERIES_CATEGORIES: Set[int] = set(RADAR_TVSHOW_CATEGORY_IDS)
ANIME_CATEGORIES: Set[int] = {449, 405}
METADATA_MISS_TTL_SECONDS = 6 * 60 * 60

ALLOWED_POSTER_HOST_SUFFIXES: Tuple[str, ...] = (
    "doubanio.com",
    "image.tmdb.org",
    "m-team.co",
    "m-team.cc",
    "ptdream.net",
    "imgtg.com",
)
POSTER_PROXY_PATH = "/api/home/poster"


def _unwrap_gateway996_url(url: str) -> str:
    """Return the stable inner image URL from M-Team's expiring gateway proxy."""
    try:
        parsed = urlparse(url)
    except (TypeError, ValueError):
        return url
    hostname = (parsed.hostname or "").lower()
    if hostname != "api.gateway996.com":
        return url
    try:
        values = parse_qs(parsed.query).get("uri")
    except ValueError:
        return url
    if not values:
        return url
    return values[0] or url


def _is_allowlisted_poster_host(hostname: Optional[str]) -> bool:
    if not hostname:
        return False
    normalized = hostname.rstrip(".").lower()
    return any(
        normalized == suffix or normalized.endswith(f".{suffix}")
        for suffix in ALLOWED_POSTER_HOST_SUFFIXES
    )


def to_proxy_poster_url(url: Optional[str]) -> Optional[str]:
    """Rewrite allowlisted poster URLs to the same-origin backend image proxy."""
    if not url:
        return None
    if url.startswith("/"):
        return url
    unwrapped = _unwrap_gateway996_url(url)
    if unwrapped.startswith("/"):
        return unwrapped
    try:
        parsed = urlparse(unwrapped)
    except (TypeError, ValueError):
        return unwrapped
    if parsed.scheme in {"http", "https"} and _is_allowlisted_poster_host(parsed.hostname):
        return f"{POSTER_PROXY_PATH}?u={quote(unwrapped, safe='')}"
    return unwrapped


def proxy_media_wall_posters(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    """Deep-copy a media-wall snapshot and proxy every rail card poster URL."""
    payload = deepcopy(snapshot)
    rails = payload.get("rails")
    if not isinstance(rails, list):
        return payload
    for rail in rails:
        if not isinstance(rail, dict):
            continue
        for cards_key in ("items", "cards"):
            cards = rail.get(cards_key)
            if not isinstance(cards, list):
                continue
            for card in cards:
                if isinstance(card, dict) and "poster_url" in card:
                    card["poster_url"] = to_proxy_poster_url(card.get("poster_url"))
    return payload


NON_SCRIPTED_SERIES_PATTERNS = [
    r"真人秀",
    r"韩综",
    r"韓綜",
    r"综艺",
    r"綜藝",
    r"嘉宾",
    r"嘉賓",
    r"第\s*\d+\s*期",
    r"加更",
    r"卫视",
    r"衛視",
    r"超高清频道",
    r"超高清頻道",
    r"新闻",
    r"新聞",
    r"\bNews\b",
    r"英语听力",
    r"雅思",
    r"托福",
    r"体育",
    r"足球",
    r"篮球",
    r"\bNBA\b",
    r"\bCCTV-?5\b",
    r"\bMusic\b",
    r"\bMelody\b",
    r"\bConcert\b",
    r"\bGala\b",
    r"\bFestival\b",
    r"\bAwards\b",
    r"\bLive\b",
    r"国乐",
    r"國樂",
    r"演唱会",
    r"演唱會",
    r"晚会",
    r"晚會",
    r"之夜",
    r"动画",
    r"動畫",
    r"\bAnime\b",
    r"アニメ",
]
NON_SCRIPTED_SERIES_RE = re.compile("|".join(NON_SCRIPTED_SERIES_PATTERNS), re.IGNORECASE)
BROADCAST_DATED_RE = re.compile(
    r"^(?:SBS|NBC|BBC|CBC|CNN|CCTV(?:-\d+)?|JSTV|ZJTV|JSWS|NEWVISION)\b"
    r".*(?:\d{8}|\d{4}\s+\d{2}\s+\d{2})",
    re.IGNORECASE,
)
NON_MOVIE_PATTERNS = [
    r"演唱会",
    r"演唱會",
    r"\bConcert\b",
    r"\bGala\b",
    r"\bFestival\b",
    r"\bAwards\b",
    r"\bLive\b",
    r"晚会",
    r"晚會",
    r"之夜",
    r"新闻",
    r"新聞",
    r"\bNews\b",
    r"体育",
    r"足球",
    r"篮球",
    r"\bNBA\b",
    r"\bCCTV-?5\b",
    r"\bVMX\b",
    r"Kamasutra",
    r"\bErotic\b",
    r"情色",
    r"成人",
]
NON_MOVIE_RE = re.compile("|".join(NON_MOVIE_PATTERNS), re.IGNORECASE)
WESTERN_REGION_RE = re.compile(
    r"美国|英[国國]|加拿大|澳大利亚|澳大利亞|新西兰|新西蘭|爱尔兰|愛爾蘭|"
    r"Ireland|United States|\bUSA\b|U\.S\.|United Kingdom|\bUK\b|Britain|England|"
    r"Canada|Australia|New Zealand",
    re.IGNORECASE,
)
ASIAN_DRAMA_REGION_RE = re.compile(
    r"韩国|韓國|日本|South Korea|Korea|Japan|韩语|韓語|日语|日語|Korean|Japanese",
    re.IGNORECASE,
)
CHINESE_REGION_RE = re.compile(
    r"中国大陆|中國大陸|大陆|大陸|中国|中國|香港|台湾|台灣|新加坡|马来西亚|馬來西亞|"
    r"Mainland China|\bChina\b|Hong Kong|Taiwan|Singapore|Malaysia|汉语|漢語|普通话|普通話|粤语|粵語|"
    r"华语|華語|中文(?!\s*字幕)|\bChinese\b(?!\s*(?:Sub|Subs|Subtitle|Subtitles))|Mandarin|Cantonese",
    re.IGNORECASE,
)
ENGLISH_AUDIO_RE = re.compile(
    r"\[(?:英语|英語|English)\]|"
    r"(?:^|[|,;/，；])\s*(?:英语|英語|English)\s*(?:[|,;/，；]|$)|"
    r"\bEnglish\b(?!\s*(?:Sub|Subs|Subtitle|Subtitles|soft\s*sub|softsubs))",
    re.IGNORECASE,
)
MAINLAND_CHINA_RE = re.compile(
    r"中国大陆|中國大陸|大陆|大陸|Mainland China",
    re.IGNORECASE,
)

RAIL_DEFINITIONS = [
    ("western_series", "英美剧更新", "4K 美剧、英剧和英语剧集更新"),
    ("foreign_movies", "近期外语电影", "近期 4K 外语电影资源"),
    ("asian_series", "日韩剧更新", "4K 韩剧、日剧更新"),
    ("chinese_series", "华语剧集", "4K 国产、港台和华语剧集"),
    ("classic_restorations", "经典补档 / 高质量收藏", "4K 修复、Remux 和收藏向资源"),
    ("quality_latest", "高质量新片新剧", "近期高质量电影和剧集补充"),
    ("popular_media", "热门影视资源", "站内热门电影和剧集精选"),
]
BOUTIQUE_RAIL_IDS = frozenset(
    (
        "western_series",
        "foreign_movies",
        "asian_series",
        "chinese_series",
        "classic_restorations",
    )
)
FALLBACK_RAIL_IDS = frozenset(("quality_latest", "popular_media"))
SOURCE_REFRESH_ORDER = ["latest", "movies", "series", "hot"]
MEDIA_WALL_SOURCE_PAGE_SIZE = 200
RECENT_UPLOAD_WINDOW_DAYS = 180
RECENT_COMPLETED_SERIES_YEAR_WINDOW = 2
RECENT_FOREIGN_MOVIE_YEAR_WINDOW = 3
RELAXED_RAIL_VISIBLE_FLOOR = 6
CHINESE_REGION_COUNTRY_IDS = {1, 2, 3, 8, 108, 109, 110}
ASIAN_REGION_COUNTRY_IDS = {5, 6}
WESTERN_REGION_COUNTRY_IDS = {4, 7}
COMPLETE_SEASON_RE = re.compile(
    r"\bComplete\b|全集|完结|完結|全\s*\d+\s*[集话話]?",
    re.IGNORECASE,
)

DATA_DIR = Path(__file__).parent.parent.parent / "data"
DEFAULT_SNAPSHOT_PATH = DATA_DIR / "media_wall_snapshot.json"
DEFAULT_METADATA_PATH = DATA_DIR / "media_metadata_cache.json"


class MediaWallService:
    """Refreshes and serves a cached Home media wall snapshot."""

    def __init__(
        self,
        *,
        client=mt_client,
        snapshot_path: Path = DEFAULT_SNAPSHOT_PATH,
        metadata_path: Path = DEFAULT_METADATA_PATH,
        refresh_interval_seconds: int = MEDIA_WALL_REFRESH_INTERVAL,
        startup_delay_seconds: int = MEDIA_WALL_STARTUP_DELAY,
        metadata_ttl_seconds: int = MEDIA_WALL_METADATA_TTL,
        metadata_miss_ttl_seconds: int = METADATA_MISS_TTL_SECONDS,
        max_metadata_fetches: int = MEDIA_WALL_MAX_METADATA_FETCHES,
        max_douban_poster_fetches: int = MEDIA_WALL_DOUBAN_POSTER_FETCHES,
        refresh_failure_backoff_seconds: int = MEDIA_WALL_REFRESH_FAILURE_BACKOFF_SECONDS,
        source_stagger_seconds: Optional[int] = None,
    ):
        self.client = client
        self.snapshot_path = Path(snapshot_path)
        self.metadata_path = Path(metadata_path)
        self.refresh_interval_seconds = refresh_interval_seconds
        self.startup_delay_seconds = startup_delay_seconds
        self.metadata_ttl_seconds = metadata_ttl_seconds
        self.metadata_miss_ttl_seconds = metadata_miss_ttl_seconds
        self.max_metadata_fetches = max_metadata_fetches
        self.max_douban_poster_fetches = max_douban_poster_fetches
        self.source_stagger_seconds = source_stagger_seconds or max(
            60,
            self.refresh_interval_seconds // len(SOURCE_REFRESH_ORDER),
        )
        self.refresh_failure_backoff_seconds = refresh_failure_backoff_seconds
        self.snapshot: Optional[Dict[str, Any]] = _read_json(self.snapshot_path)
        self.metadata_cache: Dict[str, Any] = _read_json(self.metadata_path) or {}
        self._refreshing = False

    def should_refresh(self, now: Optional[datetime] = None) -> bool:
        """Return True when no snapshot exists or the 6-hour interval elapsed."""
        now = now or datetime.now(BEIJING_TZ)
        if not self.snapshot:
            return True

        last_refreshed = _parse_datetime(self.snapshot.get("last_refreshed"))
        if not last_refreshed:
            return True

        return (now - last_refreshed).total_seconds() >= self.refresh_interval_seconds

    def get_snapshot(self, now: Optional[datetime] = None) -> Dict[str, Any]:
        """Return the current cached snapshot without touching M-Team."""
        now = now or datetime.now(BEIJING_TZ)
        if not self.snapshot:
            return self._empty_snapshot(now, status="empty")

        payload = _sanitize_snapshot(self.snapshot, now)
        payload["stale"] = (
            bool(payload.get("stale"))
            or self.should_refresh(now)
            or self._active_refresh_backoff_until(now) is not None
        )
        return payload

    async def refresh_once(self, now: Optional[datetime] = None) -> Dict[str, Any]:
        """Refresh the snapshot from M-Team, preserving the previous snapshot on failure."""
        now = now or datetime.now(BEIJING_TZ)
        backoff_until = self._active_refresh_backoff_until(now)
        if backoff_until is not None:
            return self._snapshot_with_active_backoff(now, backoff_until)
        if self._refreshing:
            return self.get_snapshot(now)

        self._refreshing = True
        try:
            torrents_by_source = await self._fetch_torrents_by_source()
            metadata_by_key = await self._metadata_for_torrents(torrents_by_source, now)
            rail_payload = build_media_wall_rails(
                torrents_by_source=torrents_by_source,
                metadata_by_key=metadata_by_key,
                now=now,
            )
            snapshot = {
                "last_refreshed": now.isoformat(),
                "next_refresh": (now + timedelta(seconds=self.refresh_interval_seconds)).isoformat(),
                "stale": False,
                "refresh_status": "ok",
                "last_error": None,
                "sources": _source_snapshot_payload(torrents_by_source, now),
                **rail_payload,
            }
            self.snapshot = snapshot
            self._persist_snapshot()
            self._persist_metadata()
            return snapshot
        except Exception as exc:
            logger.error("媒体墙刷新失败: %s", exc)
            return self._snapshot_after_refresh_failure(now, str(exc))
        finally:
            self._refreshing = False

    async def refresh_source_once(self, source: str, now: Optional[datetime] = None) -> Dict[str, Any]:
        """Refresh one media-wall source and rebuild the Home snapshot from cached sources."""
        now = now or datetime.now(BEIJING_TZ)
        if source not in SOURCE_REFRESH_ORDER:
            raise ValueError(f"Unknown media wall source: {source}")
        backoff_until = self._active_refresh_backoff_until(now)
        if backoff_until is not None:
            return self._snapshot_with_active_backoff(now, backoff_until)
        if self._refreshing:
            return self.get_snapshot(now)

        self._refreshing = True
        try:
            payload = _search_payloads()[source]
            data = await self.client.search_torrents(payload, label=f"media-wall:{source}")
            if not isinstance(data, dict) or "data" not in data:
                raise RuntimeError(f"M-Team source {source} returned an invalid search payload")
            items = _dict_items(data.get("data", []))

            sources = self._sources_from_snapshot()
            sources[source] = {
                "last_refreshed": now.isoformat(),
                "items": items,
            }
            torrents_by_source = _source_items(sources)

            await self._metadata_for_torrents(
                {source: items},
                now,
                max_fetches=self._per_source_metadata_budget(),
            )
            metadata_by_key = await self._metadata_for_torrents(
                torrents_by_source,
                now,
                max_fetches=0,
            )
            rail_payload = build_media_wall_rails(
                torrents_by_source=torrents_by_source,
                metadata_by_key=metadata_by_key,
                now=now,
            )
            snapshot = {
                "last_refreshed": now.isoformat(),
                "next_refresh": self._next_refresh_at(now, sources).isoformat(),
                "stale": False,
                "refresh_status": "ok",
                "last_error": None,
                "sources": sources,
                **rail_payload,
            }
            self.snapshot = snapshot
            self._persist_snapshot()
            self._persist_metadata()
            return snapshot
        except Exception as exc:
            logger.error("媒体墙 source 刷新失败 (%s): %s", source, exc)
            return self._snapshot_after_refresh_failure(now, str(exc))
        finally:
            self._refreshing = False

    async def run_background_loop(self) -> None:
        """Background refresh loop: delayed start, then staggered source refreshes."""
        await asyncio.sleep(self.startup_delay_seconds)
        while True:
            try:
                now = datetime.now(BEIJING_TZ)
                source = self._next_due_source(now)
                if source:
                    await self.refresh_source_once(source, now=now)
                    after_refresh = datetime.now(BEIJING_TZ)
                    sleep_seconds = (
                        self._seconds_until_next_due(after_refresh)
                        if self._active_refresh_backoff_until(after_refresh) is not None
                        else self.source_stagger_seconds
                    )
                    await asyncio.sleep(sleep_seconds)
                    continue
            except Exception as exc:
                logger.error("媒体墙后台任务异常: %s", exc)
            await asyncio.sleep(self._seconds_until_next_due(datetime.now(BEIJING_TZ)))

    async def _fetch_torrents_by_source(self) -> Dict[str, List[Dict[str, Any]]]:
        payloads = _search_payloads()
        result: Dict[str, List[Dict[str, Any]]] = {}
        for source, payload in payloads.items():
            data = await self.client.search_torrents(
                payload,
                label=f"media-wall:{source}",
            )
            if not isinstance(data, dict) or "data" not in data:
                raise RuntimeError(f"M-Team source {source} returned an invalid search payload")
            result[source] = _dict_items(data.get("data", []))
        return result

    async def _metadata_for_torrents(
        self,
        torrents_by_source: Dict[str, List[Dict[str, Any]]],
        now: datetime,
        max_fetches: Optional[int] = None,
    ) -> Dict[str, Dict[str, Any]]:
        metadata: Dict[str, Dict[str, Any]] = {}
        fetches = 0
        fetch_limit = self.max_metadata_fetches if max_fetches is None else max_fetches
        poster_fetches = 0
        poster_fetch_limit = min(self.max_douban_poster_fetches, fetch_limit)

        for torrent in _flatten_sources(torrents_by_source):
            for cache_key, cache_aliases, source_type, source_value in _metadata_sources(torrent):
                cached = _lookup_cache_entry(self.metadata_cache, [cache_key, *cache_aliases])
                cached_data = dict((cached or {}).get("data") or {})
                fetched_metadata = False
                fetched_miss = False
                if _is_fresh_cache_entry(cached, now, self.metadata_ttl_seconds):
                    data = cached_data
                elif _is_recent_metadata_miss(cached, now, self.metadata_miss_ttl_seconds):
                    data = cached_data
                elif fetches < fetch_limit:
                    fetched = await self._fetch_metadata(source_type, source_value)
                    data = dict(fetched) if fetched else cached_data
                    fetches += 1
                    fetched_metadata = bool(fetched)
                    fetched_miss = not fetched_metadata
                else:
                    data = cached_data

                cache_entry = dict(cached or {})
                if fetched_metadata and data:
                    cache_entry.update(
                        {
                            "fetched_at": now.isoformat(),
                            "data": data,
                        }
                    )
                    cache_entry.pop("missed_at", None)
                elif fetched_miss:
                    cache_entry["missed_at"] = now.isoformat()
                    if data:
                        cache_entry["data"] = data

                if (
                    source_type == "douban"
                    and data
                    and not data.get("coverUrl")
                    and poster_fetches < poster_fetch_limit
                    and not _is_recent_douban_poster_attempt(
                        cache_entry or cached,
                        now,
                        self.metadata_ttl_seconds,
                    )
                ):
                    poster_fetches += 1
                    poster_url = await fetch_douban_poster_from_page(
                        _normalize_douban_code(source_value)
                    )
                    cache_entry["douban_poster_attempted_at"] = now.isoformat()
                    if poster_url:
                        data["coverUrl"] = poster_url
                    cache_entry["data"] = data

                if (
                    cache_entry.get("data")
                    or cache_entry.get("douban_poster_attempted_at")
                    or cache_entry.get("missed_at")
                ):
                    self.metadata_cache[cache_key] = cache_entry

                if data:
                    _store_metadata_aliases(metadata, [source_value, cache_key, *cache_aliases], data)
                    break

        return metadata

    def _sources_from_snapshot(self) -> Dict[str, Dict[str, Any]]:
        if not self.snapshot:
            return {}
        sources = self.snapshot.get("sources") or {}
        return {
            source: {
                "last_refreshed": data.get("last_refreshed"),
                "items": _dict_items(data.get("items", [])),
            }
            for source, data in sources.items()
            if source in SOURCE_REFRESH_ORDER and isinstance(data, dict)
        }

    def _next_due_source(self, now: datetime) -> Optional[str]:
        if self._active_refresh_backoff_until(now) is not None:
            return None
        sources = self._sources_from_snapshot()
        for source in SOURCE_REFRESH_ORDER:
            if source not in sources:
                return source

        due_sources = []
        for source in SOURCE_REFRESH_ORDER:
            last_refreshed = _parse_datetime(sources[source].get("last_refreshed"))
            if not last_refreshed:
                return source
            due_at = last_refreshed + timedelta(seconds=self.refresh_interval_seconds)
            if now >= due_at:
                due_sources.append((due_at, source))
        if not due_sources:
            return None
        due_sources.sort(key=lambda item: (item[0], SOURCE_REFRESH_ORDER.index(item[1])))
        return due_sources[0][1]

    def _seconds_until_next_due(self, now: datetime) -> int:
        backoff_until = self._active_refresh_backoff_until(now)
        if backoff_until is not None:
            return max(1, ceil((backoff_until - now).total_seconds()))
        return self._seconds_until_next_due_from_sources(self._sources_from_snapshot(), now)

    def _seconds_until_next_due_from_sources(
        self,
        sources: Dict[str, Dict[str, Any]],
        now: datetime,
    ) -> int:
        if len(sources) < len(SOURCE_REFRESH_ORDER):
            return self.source_stagger_seconds

        due_times = []
        for source in SOURCE_REFRESH_ORDER:
            last_refreshed = _parse_datetime((sources.get(source) or {}).get("last_refreshed"))
            if not last_refreshed:
                return self.source_stagger_seconds
            due_times.append(last_refreshed + timedelta(seconds=self.refresh_interval_seconds))

        next_due = min(due_times)
        return max(60, int((next_due - now).total_seconds()))

    def _next_refresh_at(
        self,
        now: datetime,
        sources: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> datetime:
        seconds = (
            self._seconds_until_next_due_from_sources(sources, now)
            if sources is not None
            else self._seconds_until_next_due(now)
        )
        return now + timedelta(seconds=seconds)

    def _per_source_metadata_budget(self) -> int:
        if self.max_metadata_fetches <= 0:
            return 0
        return max(1, self.max_metadata_fetches // len(SOURCE_REFRESH_ORDER))

    async def _fetch_metadata(self, source_type: str, source_value: str) -> Optional[Dict[str, Any]]:
        if source_type == "douban":
            return await self.client.fetch_douban_media_info(
                _normalize_douban_code(source_value),
                refresh=False,
            )
        if source_type == "imdb":
            return await self.client.fetch_imdb_media_info(
                _normalize_imdb_code(source_value),
                refresh=False,
            )
        return None

    def _active_refresh_backoff_until(self, now: datetime) -> Optional[datetime]:
        if not self.snapshot:
            return None
        backoff_until = _parse_datetime(self.snapshot.get("refresh_backoff_until"))
        if backoff_until is None or now >= backoff_until:
            return None
        return backoff_until

    def _snapshot_with_active_backoff(
        self,
        now: datetime,
        backoff_until: datetime,
    ) -> Dict[str, Any]:
        snapshot = dict(self.snapshot or self._empty_snapshot(now, status="empty"))
        snapshot["stale"] = True
        snapshot["next_refresh"] = backoff_until.isoformat()
        self.snapshot = snapshot
        self._persist_snapshot()
        return snapshot

    def _snapshot_after_refresh_failure(self, now: datetime, error: str) -> Dict[str, Any]:
        backoff_until = now + timedelta(seconds=self.refresh_failure_backoff_seconds)
        snapshot = (
            dict(self.snapshot)
            if self.snapshot
            else self._empty_snapshot(now, status="error", error=error)
        )
        snapshot["next_refresh"] = backoff_until.isoformat()
        snapshot["stale"] = True
        snapshot["refresh_status"] = "error"
        snapshot["last_error"] = error
        snapshot["refresh_backoff_until"] = backoff_until.isoformat()
        snapshot["refresh_backoff_reason"] = error
        self.snapshot = snapshot
        self._persist_snapshot()
        return snapshot

    def _empty_snapshot(
        self,
        now: datetime,
        *,
        status: str,
        error: Optional[str] = None,
    ) -> Dict[str, Any]:
        return {
            "last_refreshed": None,
            "next_refresh": now.isoformat(),
            "stale": True,
            "refresh_status": status,
            "last_error": error,
            "rails": [_rail(rail_id, []) for rail_id, _, _ in RAIL_DEFINITIONS],
            "diagnostics": _empty_diagnostics(),
        }

    def _persist_snapshot(self) -> None:
        _write_json(self.snapshot_path, self.snapshot or {})

    def _persist_metadata(self) -> None:
        _write_json(self.metadata_path, self.metadata_cache)


def extract_episode_token(name: str) -> Optional[str]:
    """Extract a compact episode token from common release-name formats."""
    patterns = [
        r"\bS(\d{1,2})E(\d{1,4})\b",
        r"\bEP(?:ISODE)?[\s._-]?(\d{1,4})\b",
        r"第\s*(\d{1,4})\s*[集话話]",
    ]
    for pattern in patterns:
        match = re.search(pattern, name, flags=re.IGNORECASE)
        if not match:
            continue
        if pattern.startswith(r"\bS"):
            season, episode = match.groups()
            return f"S{int(season):02d}E{int(episode):02d}"
        if pattern.startswith(r"\bEP"):
            return f"EP{int(match.group(1)):02d}"
        return f"第{int(match.group(1))}集"
    return None


def extract_season_token(name: str) -> Optional[str]:
    """Extract a season-pack token from release names or Chinese descriptions."""
    patterns = [
        r"\bS(\d{1,2})(?!\s*E\d{1,3})\b",
        r"\bSeason[\s._-]?(\d{1,2})\b",
        r"第\s*(\d{1,3}|[一二三四五六七八九十]{1,4})\s*季",
    ]
    for pattern in patterns:
        match = re.search(pattern, name, flags=re.IGNORECASE)
        if not match:
            continue
        value = match.group(1)
        number = _chinese_number_to_int(value) if not value.isdigit() else int(value)
        if number is None:
            continue
        return f"S{number:02d}"
    return None


def extract_series_token(torrent: Dict[str, Any]) -> Optional[str]:
    """Extract an episode or season token from the fields M-Team commonly fills."""
    text = " ".join(
        str(torrent.get(field_name, ""))
        for field_name in ("name", "smallDescr")
        if torrent.get(field_name)
    )
    return extract_episode_token(text) or extract_season_token(text)


def is_media_wall_series_candidate(torrent: Dict[str, Any]) -> bool:
    """Return True for scripted series-like items suitable for the Home media wall."""
    if extract_series_token(torrent) is None:
        return False

    text = " ".join(
        str(torrent.get(field_name, ""))
        for field_name in ("name", "smallDescr", "description")
        if torrent.get(field_name)
    )
    if NON_SCRIPTED_SERIES_RE.search(text):
        return False
    if BROADCAST_DATED_RE.search(text):
        return False
    return True


def is_recent_series_update_candidate(
    torrent: Dict[str, Any],
    metadata: Dict[str, Any],
    now: datetime,
) -> bool:
    """Return True for current/recent scripted series updates shown on Home."""
    if not is_media_wall_series_candidate(torrent):
        return False

    year = (
        _metadata_year(metadata)
        or _year_from_torrent_name(str(torrent.get("name", "")))
        or _year_from_torrent_name(str(torrent.get("smallDescr", "")))
    )
    if year is not None:
        if year >= _min_series_update_year(now):
            return True
        return _is_recent_completed_series_pack(torrent, year, now)

    text = " ".join(
        str(torrent.get(field_name, ""))
        for field_name in ("name", "smallDescr")
        if torrent.get(field_name)
    )
    return extract_episode_token(text) is not None


def _metadata_text(metadata: Dict[str, Any]) -> str:
    parts: List[str] = []
    for key in (
        "country",
        "countries",
        "languages",
        "language",
        "genres",
        "genre",
        "intro",
        "title",
        "originalTitle",
    ):
        value = metadata.get(key)
        if isinstance(value, list):
            parts.extend(str(item) for item in value if item)
        elif isinstance(value, dict):
            parts.extend(str(item) for item in value.values() if item)
        elif value:
            parts.append(str(value))
    return " | ".join(parts)


def _torrent_text(torrent: Dict[str, Any]) -> str:
    return " | ".join(
        str(torrent.get(field_name, ""))
        for field_name in ("name", "smallDescr", "description")
        if torrent.get(field_name)
    )


def _combined_text(torrent: Dict[str, Any], metadata: Dict[str, Any]) -> str:
    return " | ".join(part for part in (_metadata_text(metadata), _torrent_text(torrent)) if part)

def _metadata_region_hint(metadata: Dict[str, Any]) -> Optional[str]:
    structured_parts: List[str] = []
    for key in ("country", "countries", "language", "languages", "originalTitle"):
        value = metadata.get(key)
        if isinstance(value, list):
            structured_parts.extend(str(item) for item in value if item)
        elif isinstance(value, dict):
            structured_parts.extend(str(item) for item in value.values() if item)
        elif value:
            structured_parts.append(str(value))

    for text in (" | ".join(structured_parts), _metadata_text(metadata)):
        if not text:
            continue
        if CHINESE_REGION_RE.search(text):
            return "chinese"
        if ASIAN_DRAMA_REGION_RE.search(text):
            return "asian"
        if WESTERN_REGION_RE.search(text) or ENGLISH_AUDIO_RE.search(text):
            return "western"
        if structured_parts:
            break
    return None


def _torrent_region_hint(torrent: Dict[str, Any]) -> Optional[str]:
    if _has_chinese_country_code(torrent):
        return "chinese"
    if _has_asian_country_code(torrent):
        return "asian"
    if _has_western_country_code(torrent):
        return "western"

    text = _torrent_text(torrent)
    if CHINESE_REGION_RE.search(text):
        return "chinese"
    if ASIAN_DRAMA_REGION_RE.search(text):
        return "asian"
    if WESTERN_REGION_RE.search(text) or ENGLISH_AUDIO_RE.search(text):
        return "western"
    return None


def _series_region_hint(torrent: Dict[str, Any], metadata: Dict[str, Any]) -> Optional[str]:
    metadata_region = _metadata_region_hint(metadata)
    if metadata_region:
        return metadata_region
    return _torrent_region_hint(torrent)



def has_4k_quality(value: Dict[str, Any]) -> bool:
    """Return True when a torrent/card is explicitly 4K or 2160p/UHD."""
    tags = set(str(tag) for tag in value.get("quality_tags", []) if tag)
    if {"4K", "2160p"} & tags:
        return True

    text = " ".join(
        str(value.get(field_name, ""))
        for field_name in ("name", "torrent_name")
        if value.get(field_name)
    )
    return bool(re.search(r"\b(?:4K|2160p|UHD)\b", text, flags=re.IGNORECASE))


def _has_high_quality_1080p(value: Dict[str, Any]) -> bool:
    tags = set(str(tag) for tag in value.get("quality_tags", []) if tag)
    if not tags:
        text = str(value.get("name") or value.get("torrent_name") or "")
        tags = set(extract_quality_tags(text))
    return bool(
        "1080p" in tags
        and not ({"4K", "2160p"} & tags)
        and {"BluRay", "WEB-DL", "Remux", "H.265", "H.264"} & tags
    )


def _has_quality_for_relaxed_fill(value: Dict[str, Any]) -> bool:
    return has_4k_quality(value) or _has_high_quality_1080p(value)


def _is_western_series_match(torrent: Dict[str, Any], metadata: Dict[str, Any], now: datetime) -> bool:
    return (
        is_recent_series_update_candidate(torrent, metadata, now)
        and _series_region_hint(torrent, metadata) == "western"
    )


def _is_asian_series_match(torrent: Dict[str, Any], metadata: Dict[str, Any], now: datetime) -> bool:
    return (
        is_recent_series_update_candidate(torrent, metadata, now)
        and _series_region_hint(torrent, metadata) == "asian"
    )


def _is_chinese_series_match(torrent: Dict[str, Any], metadata: Dict[str, Any], now: datetime) -> bool:
    return (
        is_recent_series_update_candidate(torrent, metadata, now)
        and _series_region_hint(torrent, metadata) == "chinese"
    )


def _is_western_series(torrent: Dict[str, Any], metadata: Dict[str, Any], now: datetime) -> bool:
    return _is_western_series_match(torrent, metadata, now) and has_4k_quality(torrent)


def _is_asian_series(torrent: Dict[str, Any], metadata: Dict[str, Any], now: datetime) -> bool:
    return _is_asian_series_match(torrent, metadata, now) and has_4k_quality(torrent)


def _is_chinese_series(torrent: Dict[str, Any], metadata: Dict[str, Any], now: datetime) -> bool:
    return _is_chinese_series_match(torrent, metadata, now) and has_4k_quality(torrent)


def _is_foreign_recent_movie(torrent: Dict[str, Any], metadata: Dict[str, Any], now: datetime) -> bool:
    if classify_media_type(torrent) != "movie":
        return False
    if not has_4k_quality(torrent):
        return False
    if not is_media_wall_movie_candidate(torrent):
        return False
    if _has_chinese_country_code(torrent):
        return False

    year = _metadata_year(metadata) or _year_from_torrent_name(str(torrent.get("name", "")))
    if year is None:
        return False
    if year >= now.year - 2:
        return not CHINESE_REGION_RE.search(_combined_text(torrent, metadata))
    if year < now.year - RECENT_FOREIGN_MOVIE_YEAR_WINDOW:
        return False

    return _is_recent_upload(torrent, now) and not CHINESE_REGION_RE.search(
        _combined_text(torrent, metadata)
    )


def is_media_wall_movie_candidate(torrent: Dict[str, Any]) -> bool:
    """Return True for movie-like items suitable for the Home media wall."""
    text = " ".join(
        str(torrent.get(field_name, ""))
        for field_name in ("name", "smallDescr", "description")
        if torrent.get(field_name)
    )
    if NON_MOVIE_RE.search(text):
        return False
    if BROADCAST_DATED_RE.search(text):
        return False
    return True


def classify_media_type(torrent: Dict[str, Any]) -> str:
    """Classify a torrent as movie, series, anime, or other."""
    category = _safe_int(torrent.get("category"))
    series_token = extract_series_token(torrent)
    if category in ANIME_CATEGORIES:
        return "anime"
    if category in SERIES_CATEGORIES or series_token:
        return "series"
    if category in MOVIE_CATEGORIES:
        return "movie"
    return "other"


def extract_quality_tags(name: str) -> List[str]:
    """Extract media-wall quality badges in a stable display order."""
    checks = [
        ("4K", r"\b(?:4K|UHD)\b"),
        ("2160p", r"\b2160p\b"),
        ("1080p", r"\b1080p\b"),
        ("Dolby Vision", r"\b(?:Dolby\s*Vision|DoVi|DV)\b"),
        ("Remux", r"\bREMUX\b"),
        ("BluRay", r"\b(?:BluRay|Blu-Ray)\b"),
        ("WEB-DL", r"\bWEB[-_. ]?DL\b"),
        ("H.265", r"\b(?:H\.?265|HEVC|x265)\b"),
        ("H.264", r"\b(?:H\.?264|AVC|x264)\b"),
        ("AV1", r"\bAV1\b"),
        ("HDR10", r"\bHDR10(?:\+|Plus)?\b"),
        ("HDR", r"\bHDR\b"),
        ("HLG", r"\bHLG\b"),
        ("Atmos", r"\bAtmos\b"),
        ("TrueHD", r"\bTrueHD\b"),
        ("DTS-HD", r"\bDTS[-_. ]?HD\b"),
        ("中字", r"(中字|简中|繁中|CHS|CHT|Chinese)"),
    ]
    tags: List[str] = []
    for label, pattern in checks:
        if re.search(pattern, name, flags=re.IGNORECASE) and label not in tags:
            tags.append(label)
    return tags


def _quality_score(card: Dict[str, Any]) -> int:
    tags = set(card.get("quality_tags", []))
    score = 0
    score += 100 if "Dolby Vision" in tags else 0
    score += 90 if "Remux" in tags else 0
    score += 70 if "H.265" in tags else 0
    score += 45 if {"HDR10", "HDR", "HLG"} & tags else 0
    score += 30 if {"Atmos", "TrueHD", "DTS-HD"} & tags else 0
    score += 15 if "BluRay" in tags else 0
    score += 10 if "WEB-DL" in tags else 0
    return score


def _created_timestamp(card: Dict[str, Any]) -> float:
    parsed = _parse_datetime(card.get("created_date"))
    return parsed.timestamp() if parsed else 0.0


def _sort_home_cards(cards: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    ranked = sorted(
        cards,
        key=lambda card: (
            _quality_score(card),
            _created_timestamp(card),
            _safe_int(card.get("leechers")),
            _safe_int(card.get("seeders")),
        ),
        reverse=True,
    )
    return _dedupe_cards(ranked)


def build_media_wall_rails(
    *,
    torrents_by_source: Dict[str, List[Dict[str, Any]]],
    metadata_by_key: Dict[str, Dict[str, Any]],
    now: datetime,
    items_per_rail: int = 12,
) -> Dict[str, Any]:
    """Build the read-only family media-wall rail payload from search snapshots."""
    diagnostics = {
        "sources": _source_diagnostics(torrents_by_source),
        "rails": {},
    }

    asian_series, asian_counts = _series_items_for_region(
        torrents_by_source,
        metadata_by_key,
        now,
        items_per_rail,
        _is_asian_series_match,
        "日韩 4K 剧集更新",
        "日韩高质量剧集更新",
    )
    chinese_series, chinese_counts = _series_items_for_region(
        torrents_by_source,
        metadata_by_key,
        now,
        min(items_per_rail, 8),
        _is_chinese_series_match,
        "华语 4K 剧集更新",
        "华语高质量剧集更新",
    )
    western_series, western_counts = _series_items_for_region(
        torrents_by_source,
        metadata_by_key,
        now,
        items_per_rail,
        _is_western_series_match,
        "英美 4K 剧集更新",
        "英美高质量剧集更新",
        _card_keys([*asian_series, *chinese_series]),
    )
    foreign_movies, foreign_counts = _recent_foreign_movie_items(
        torrents_by_source,
        metadata_by_key,
        now,
        items_per_rail,
    )

    claimed_keys = _card_keys([*western_series, *foreign_movies, *asian_series, *chinese_series])
    classic_restorations, classic_counts = _classic_collection_items(
        torrents_by_source,
        metadata_by_key,
        now,
        items_per_rail,
        claimed_keys,
    )
    claimed_keys |= _card_keys(classic_restorations)
    quality_latest, quality_counts = _quality_latest_items(
        torrents_by_source,
        metadata_by_key,
        now,
        items_per_rail,
        claimed_keys,
    )
    claimed_keys |= _card_keys(quality_latest)
    popular_media, popular_counts = _popular_media_items(
        torrents_by_source,
        metadata_by_key,
        now,
        items_per_rail,
        claimed_keys,
    )

    rails = [
        _rail("western_series", western_series),
        _rail("foreign_movies", foreign_movies),
        _rail("asian_series", asian_series),
        _rail("chinese_series", chinese_series),
        _rail("classic_restorations", classic_restorations),
        _rail("quality_latest", quality_latest),
        _rail("popular_media", popular_media),
    ]
    for rail_id, counts in (
        ("western_series", western_counts),
        ("foreign_movies", foreign_counts),
        ("asian_series", asian_counts),
        ("chinese_series", chinese_counts),
        ("classic_restorations", classic_counts),
        ("quality_latest", quality_counts),
        ("popular_media", popular_counts),
    ):
        diagnostics["rails"][rail_id] = counts
    return {"rails": rails, "diagnostics": diagnostics}


def _search_payloads() -> Dict[str, Dict[str, Any]]:
    movie_categories = RADAR_MOVIE_CATEGORY_IDS
    series_categories = RADAR_TVSHOW_CATEGORY_IDS
    visual_categories = [*movie_categories, *series_categories]

    return {
        "latest": {
            "mode": "normal",
            "categories": visual_categories,
            "pageNumber": 1,
            "pageSize": MEDIA_WALL_SOURCE_PAGE_SIZE,
            "sortField": "CREATED_DATE",
            "sortDirection": "DESC",
        },
        "movies": {
            "mode": "movie",
            "categories": movie_categories,
            "pageNumber": 1,
            "pageSize": MEDIA_WALL_SOURCE_PAGE_SIZE,
            "sortField": "CREATED_DATE",
            "sortDirection": "DESC",
        },
        "series": {
            "mode": "tvshow",
            "categories": series_categories,
            "pageNumber": 1,
            "pageSize": MEDIA_WALL_SOURCE_PAGE_SIZE,
            "sortField": "CREATED_DATE",
            "sortDirection": "DESC",
        },
        "hot": {
            "mode": "movie",
            "categories": movie_categories,
            "pageNumber": 1,
            "pageSize": MEDIA_WALL_SOURCE_PAGE_SIZE,
            "sortField": "LEECHERS",
            "sortDirection": "DESC",
        },
    }


def _source_snapshot_payload(
    torrents_by_source: Dict[str, List[Dict[str, Any]]],
    now: datetime,
) -> Dict[str, Dict[str, Any]]:
    return {
        source: {
            "last_refreshed": now.isoformat(),
            "items": _dict_items(torrents_by_source.get(source, [])),
        }
        for source in SOURCE_REFRESH_ORDER
    }


def _source_items(sources: Dict[str, Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    return {
        source: _dict_items((sources.get(source) or {}).get("items", []))
        for source in SOURCE_REFRESH_ORDER
    }


def _rail(rail_id: str, items: List[Dict[str, Any]]) -> Dict[str, Any]:
    title, description = next(
        (title, description)
        for current_id, title, description in RAIL_DEFINITIONS
        if current_id == rail_id
    )
    return {
        "id": rail_id,
        "title": title,
        "description": description,
        "items": items,
    }


def _is_valid_cached_media_wall_item(item: Dict[str, Any]) -> bool:
    return (
        all(
            isinstance(item.get(key), str)
            for key in ("id", "media_key", "title", "torrent_name")
        )
        and item.get("media_type") in {"movie", "series", "other"}
    )


def _sanitize_snapshot(snapshot: Dict[str, Any], now: datetime) -> Dict[str, Any]:
    """Keep cached Home content visible while normalizing older rail shapes."""
    current_rail_ids = {rail_id for rail_id, _, _ in RAIL_DEFINITIONS}
    payload = dict(snapshot)
    items_by_rail: Dict[str, List[Dict[str, Any]]] = {
        rail_id: [] for rail_id, _, _ in RAIL_DEFINITIONS
    }

    rails = payload.get("rails")
    if not isinstance(rails, list):
        rails = []

    for rail in rails:
        if not isinstance(rail, dict):
            continue
        rail_id = str(rail.get("id") or "")
        rail_items = rail.get("items")
        if not isinstance(rail_items, list):
            rail_items = []
        items = [
            item
            for item in rail_items
            if isinstance(item, dict) and _is_valid_cached_media_wall_item(item)
        ]
        if rail_id in current_rail_ids:
            items_by_rail[rail_id].extend(
                item for item in items if _is_cached_family_item_allowed(rail_id, item, now)
            )
            continue

        for item in items:
            if _is_cached_fallback_item_allowed(item, now):
                items_by_rail["quality_latest"].append(item)
                items_by_rail["popular_media"].append(item)

    sanitized_rails = []
    claimed_keys: Set[str] = set()
    for rail_id, _, _ in RAIL_DEFINITIONS:
        cards = []
        for item in _sort_home_cards(items_by_rail[rail_id]):
            key = _card_key(item)
            if key in claimed_keys:
                continue
            cards.append(item)
            claimed_keys.add(key)
        sanitized_rails.append(_rail(rail_id, cards))

    payload["rails"] = sanitized_rails
    payload["diagnostics"] = _diagnostics_for_sanitized_snapshot(payload, sanitized_rails)
    return payload


def _diagnostics_for_sanitized_snapshot(
    payload: Dict[str, Any],
    rails: List[Dict[str, Any]],
) -> Dict[str, Any]:
    sources: Dict[str, Any] = {}
    raw_sources = payload.get("sources")
    if isinstance(raw_sources, dict):
        sources = raw_sources
    source_diagnostics: Dict[str, int] = {}
    for source in SOURCE_REFRESH_ORDER:
        source_data = sources.get(source)
        if not isinstance(source_data, dict):
            source_diagnostics[source] = 0
            continue
        source_diagnostics[source] = len(_dict_items(source_data.get("items", [])))

    rail_diagnostics = {}
    for rail in rails:
        rail_id = str(rail.get("id"))
        items = _dict_items(rail.get("items", []))
        strict = 0
        high_quality_1080p = 0
        for item in items:
            if has_4k_quality(item):
                strict += 1
            if _has_high_quality_1080p(item):
                high_quality_1080p += 1
        rail_diagnostics[rail_id] = {
            "items": len(items),
            "strict": strict,
            "relaxed": high_quality_1080p if rail_id in BOUTIQUE_RAIL_IDS else 0,
            "fallback": high_quality_1080p if rail_id in FALLBACK_RAIL_IDS else 0,
        }

    return {
        "sources": source_diagnostics,
        "rails": rail_diagnostics,
    }


def _is_cached_family_item_allowed(rail_id: str, item: Dict[str, Any], now: datetime) -> bool:
    if item.get("media_type") == "anime":
        return False
    if rail_id in {"western_series", "asian_series", "chinese_series"}:
        return _has_quality_for_relaxed_fill(item) and _is_cached_recent_series_update_allowed(item, now)
    if rail_id == "foreign_movies":
        return _has_quality_for_relaxed_fill(item) and _is_cached_foreign_movie_item_allowed(item, now)
    if rail_id == "classic_restorations":
        return _is_cached_classic_item_allowed(item, now)
    if rail_id in {"quality_latest", "popular_media"}:
        return _is_cached_fallback_item_allowed(item, now)
    return False


def _is_cached_fallback_item_allowed(item: Dict[str, Any], now: datetime) -> bool:
    if item.get("media_type") == "anime":
        return False
    if not _has_quality_for_relaxed_fill(item):
        return False
    media_type = item.get("media_type")
    if media_type == "movie":
        return _is_cached_movie_item_allowed(item)
    if media_type == "series":
        return _is_cached_recent_series_update_allowed(item, now)
    return False

def _cached_item_as_torrent(item: Dict[str, Any], *, media_type: str) -> Dict[str, Any]:
    category = next(iter(SERIES_CATEGORIES if media_type == "series" else MOVIE_CATEGORIES))
    return {
        "category": category,
        "name": item.get("torrent_name") or item.get("title") or "",
        "smallDescr": item.get("description") or "",
        "description": item.get("description") or "",
    }


def _is_cached_foreign_movie_item_allowed(item: Dict[str, Any], now: datetime) -> bool:
    if item.get("media_type") != "movie" or not _is_cached_movie_item_allowed(item):
        return False
    year = _safe_int(item.get("year")) or _year_from_torrent_name(
        str(item.get("torrent_name") or item.get("title") or "")
    )
    if not year:
        return False
    if year >= now.year - 2:
        pass
    elif year >= now.year - RECENT_FOREIGN_MOVIE_YEAR_WINDOW:
        pseudo_torrent = {
            "createdDate": item.get("created_date"),
            "name": item.get("torrent_name") or item.get("title") or "",
        }
        if not _is_recent_upload(pseudo_torrent, now):
            return False
    else:
        return False
    text = " ".join(
        str(item.get(field_name, ""))
        for field_name in ("torrent_name", "title", "description")
        if item.get(field_name)
    )
    return not CHINESE_REGION_RE.search(text)


def _is_cached_classic_item_allowed(item: Dict[str, Any], now: datetime) -> bool:
    if item.get("media_type") != "movie" or not _is_cached_movie_item_allowed(item):
        return False
    year = _safe_int(item.get("year")) or _year_from_torrent_name(
        str(item.get("torrent_name") or item.get("title") or "")
    )
    if not year:
        return False
    if year and year > now.year - 3:
        return False
    text = " ".join(
        str(item.get(field_name, ""))
        for field_name in ("torrent_name", "title", "description")
        if item.get(field_name)
    )
    tags = set(item.get("quality_tags") or extract_quality_tags(text))
    return bool(
        ({"4K", "2160p"} & tags or ("1080p" in tags and {"BluRay", "WEB-DL", "Remux", "H.265", "H.264"} & tags))
        and _has_collection_quality_tags(tags)
    )


def _is_cached_latest_item_allowed(item: Dict[str, Any]) -> bool:
    media_type = item.get("media_type")
    if media_type == "movie":
        return _is_cached_movie_item_allowed(item)
    if media_type == "series":
        return _is_cached_series_item_allowed(item)
    return False


def _is_cached_series_item_allowed(item: Dict[str, Any]) -> bool:
    if not item.get("episode"):
        return False
    text = " ".join(
        str(item.get(field_name, ""))
        for field_name in ("torrent_name", "title", "description")
        if item.get(field_name)
    )
    if not text.strip():
        return True
    return is_media_wall_series_candidate(_cached_item_as_torrent(item, media_type="series"))


def _is_cached_recent_series_update_allowed(item: Dict[str, Any], now: datetime) -> bool:
    if not _is_cached_series_item_allowed(item):
        return False

    year = _safe_int(item.get("year")) or _year_from_torrent_name(
        str(item.get("torrent_name") or item.get("title") or "")
    )
    if year:
        if year >= _min_series_update_year(now):
            return True
        pseudo_torrent = _cached_item_as_torrent(item, media_type="series")
        pseudo_torrent["createdDate"] = item.get("created_date")
        return _is_recent_completed_series_pack(pseudo_torrent, year, now)

    text = " ".join(
        str(item.get(field_name, ""))
        for field_name in ("torrent_name", "title", "description")
        if item.get(field_name)
    )
    return extract_episode_token(text) is not None


def _is_cached_movie_item_allowed(item: Dict[str, Any]) -> bool:
    text = " ".join(
        str(item.get(field_name, ""))
        for field_name in ("torrent_name", "title", "description")
        if item.get(field_name)
    )
    if not text.strip():
        return True
    return is_media_wall_movie_candidate(_cached_item_as_torrent(item, media_type="movie"))


def _min_series_update_year(now: datetime) -> int:
    return now.year - 1


def _is_recent_completed_series_pack(torrent: Dict[str, Any], year: int, now: datetime) -> bool:
    return (
        year >= now.year - RECENT_COMPLETED_SERIES_YEAR_WINDOW
        and _is_recent_upload(torrent, now)
        and _is_complete_season_pack(torrent)
    )


def _is_complete_season_pack(torrent: Dict[str, Any]) -> bool:
    text = " ".join(
        str(torrent.get(field_name, ""))
        for field_name in ("name", "smallDescr", "description")
        if torrent.get(field_name)
    )
    if extract_season_token(text) is None:
        return False
    return extract_episode_token(text) is None or bool(COMPLETE_SEASON_RE.search(text))


def _is_recent_upload(
    torrent: Dict[str, Any],
    now: datetime,
    max_age_days: int = RECENT_UPLOAD_WINDOW_DAYS,
) -> bool:
    created = _parse_datetime(torrent.get("createdDate") or torrent.get("created_date"))
    if not created:
        return False
    return created >= now - timedelta(days=max_age_days)


def _torrent_country_ids(torrent: Dict[str, Any]) -> Set[int]:
    raw = torrent.get("countries")
    if raw is None:
        raw = torrent.get("country")
    if raw is None:
        return set()

    if isinstance(raw, list):
        values = raw
    elif isinstance(raw, tuple):
        values = list(raw)
    elif isinstance(raw, dict):
        values = [raw.get("id")]
    else:
        values = re.split(r"[,;\s]+", str(raw))

    country_ids: Set[int] = set()
    for value in values:
        current = value.get("id") if isinstance(value, dict) else value
        if str(current).strip().isdigit():
            country_ids.add(int(str(current).strip()))
    return country_ids


def _has_chinese_country_code(torrent: Dict[str, Any]) -> bool:
    return bool(_torrent_country_ids(torrent) & CHINESE_REGION_COUNTRY_IDS)


def _has_asian_country_code(torrent: Dict[str, Any]) -> bool:
    return bool(_torrent_country_ids(torrent) & ASIAN_REGION_COUNTRY_IDS)


def _has_western_country_code(torrent: Dict[str, Any]) -> bool:
    return bool(_torrent_country_ids(torrent) & WESTERN_REGION_COUNTRY_IDS)


def _series_source_candidates(torrents_by_source: Dict[str, List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    return [
        *_dict_items(torrents_by_source.get("latest", [])),
        *_dict_items(torrents_by_source.get("series", [])),
    ]


def _movie_source_candidates(torrents_by_source: Dict[str, List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    return [
        *_dict_items(torrents_by_source.get("latest", [])),
        *_dict_items(torrents_by_source.get("movies", [])),
    ]


def _merge_strict_and_relaxed(
    strict_cards: List[Dict[str, Any]],
    relaxed_cards: List[Dict[str, Any]],
    limit: int,
) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
    strict = _sort_home_cards(strict_cards)
    relaxed = _sort_home_cards(relaxed_cards)
    cards = strict[:limit]
    floor = min(limit, RELAXED_RAIL_VISIBLE_FLOOR)
    if len(cards) < floor:
        claimed = _card_keys(cards)
        for card in relaxed:
            if _card_key(card) in claimed:
                continue
            cards.append(card)
            claimed.add(_card_key(card))
            if len(cards) >= floor:
                break
    return cards, _rail_counts(cards)


def _rail_counts(
    cards: List[Dict[str, Any]],
    *,
    strict_label: str = "strict",
    relaxed_label: str = "relaxed",
) -> Dict[str, int]:
    strict = sum(1 for card in cards if has_4k_quality(card))
    relaxed = sum(1 for card in cards if _has_high_quality_1080p(card))
    return {
        "items": len(cards),
        "strict": strict if strict_label == "strict" else 0,
        "relaxed": relaxed if relaxed_label == "relaxed" else 0,
        "fallback": relaxed if relaxed_label == "fallback" else 0,
    }


def _source_diagnostics(torrents_by_source: Dict[str, List[Dict[str, Any]]]) -> Dict[str, int]:
    return {
        source: len(_dict_items(torrents_by_source.get(source, [])))
        for source in SOURCE_REFRESH_ORDER
    }


def _empty_diagnostics() -> Dict[str, Any]:
    return {
        "sources": {source: 0 for source in SOURCE_REFRESH_ORDER},
        "rails": {
            rail_id: {"items": 0, "strict": 0, "relaxed": 0, "fallback": 0}
            for rail_id, _, _ in RAIL_DEFINITIONS
        },
    }


def _has_collection_quality_tags(tags: Set[str]) -> bool:
    return bool(
        {
            "Dolby Vision",
            "Remux",
            "H.265",
            "HDR10",
            "HDR",
            "HLG",
            "Atmos",
            "TrueHD",
            "DTS-HD",
            "BluRay",
        }
        & tags
    )


def _is_foreign_recent_movie_match(torrent: Dict[str, Any], metadata: Dict[str, Any], now: datetime) -> bool:
    if classify_media_type(torrent) != "movie":
        return False
    if not is_media_wall_movie_candidate(torrent):
        return False
    if _has_chinese_country_code(torrent):
        return False

    year = _metadata_year(metadata) or _year_from_torrent_name(str(torrent.get("name", "")))
    if year is None:
        return False
    if year >= now.year - 2:
        return not CHINESE_REGION_RE.search(_combined_text(torrent, metadata))
    if year < now.year - RECENT_FOREIGN_MOVIE_YEAR_WINDOW:
        return False

    return _is_recent_upload(torrent, now) and not CHINESE_REGION_RE.search(
        _combined_text(torrent, metadata)
    )


def _series_items_for_region(
    torrents_by_source: Dict[str, List[Dict[str, Any]]],
    metadata_by_key: Dict[str, Dict[str, Any]],
    now: datetime,
    limit: int,
    predicate: Callable[[Dict[str, Any], Dict[str, Any], datetime], bool],
    strict_reason: str,
    relaxed_reason: str,
    excluded_keys: Optional[Set[str]] = None,
) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
    excluded_keys = excluded_keys or set()
    strict_cards: List[Dict[str, Any]] = []
    relaxed_cards: List[Dict[str, Any]] = []
    for item in _series_source_candidates(torrents_by_source):
        if classify_media_type(item) != "series":
            continue
        metadata = _lookup_metadata(item, metadata_by_key)
        if not predicate(item, metadata, now):
            continue
        if has_4k_quality(item):
            card = _to_media_card(item, metadata_by_key, strict_reason)
            if _card_key(card) not in excluded_keys:
                strict_cards.append(card)
            continue
        if _has_high_quality_1080p(item):
            card = _to_media_card(item, metadata_by_key, relaxed_reason)
            if _card_key(card) not in excluded_keys:
                relaxed_cards.append(card)

    return _merge_strict_and_relaxed(strict_cards, relaxed_cards, limit)


def _recent_foreign_movie_items(
    torrents_by_source: Dict[str, List[Dict[str, Any]]],
    metadata_by_key: Dict[str, Dict[str, Any]],
    now: datetime,
    limit: int,
) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
    strict_cards: List[Dict[str, Any]] = []
    relaxed_cards: List[Dict[str, Any]] = []
    for item in _movie_source_candidates(torrents_by_source):
        metadata = _lookup_metadata(item, metadata_by_key)
        if not _is_foreign_recent_movie_match(item, metadata, now):
            continue
        if has_4k_quality(item):
            strict_cards.append(_to_media_card(item, metadata_by_key, "近期 4K 外语电影"))
        elif _has_high_quality_1080p(item):
            relaxed_cards.append(_to_media_card(item, metadata_by_key, "近期高质量外语电影"))
    return _merge_strict_and_relaxed(strict_cards, relaxed_cards, limit)


def _classic_collection_items(
    torrents_by_source: Dict[str, List[Dict[str, Any]]],
    metadata_by_key: Dict[str, Dict[str, Any]],
    now: datetime,
    limit: int,
    excluded_keys: Optional[Set[str]] = None,
) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
    max_recent_year = now.year - 3
    excluded_keys = excluded_keys or set()
    strict_cards: List[Dict[str, Any]] = []
    relaxed_cards: List[Dict[str, Any]] = []
    for item in [
        *_dict_items(torrents_by_source.get("hot", [])),
        *_dict_items(torrents_by_source.get("movies", [])),
        *_dict_items(torrents_by_source.get("latest", [])),
    ]:
        if classify_media_type(item) != "movie":
            continue
        if not is_media_wall_movie_candidate(item):
            continue
        metadata = _lookup_metadata(item, metadata_by_key)
        year = _metadata_year(metadata) or _year_from_torrent_name(str(item.get("name", "")))
        if year is None or year > max_recent_year:
            continue
        card = _to_media_card(
            item,
            metadata_by_key,
            "经典 4K 高质量收藏" if has_4k_quality(item) else "经典高质量收藏",
        )
        if _card_key(card) in excluded_keys:
            continue
        tags = set(card.get("quality_tags", []))
        if has_4k_quality(card):
            if _has_collection_quality_tags(tags):
                strict_cards.append(card)
        elif _has_high_quality_1080p(card) and _has_collection_quality_tags(tags):
            relaxed_cards.append(card)
    return _merge_strict_and_relaxed(strict_cards, relaxed_cards, limit)


def _is_quality_latest_candidate(
    item: Dict[str, Any],
    metadata_by_key: Dict[str, Dict[str, Any]],
    now: datetime,
) -> bool:
    if not _has_quality_for_relaxed_fill(item):
        return False
    media_type = classify_media_type(item)
    if media_type == "movie":
        metadata = _lookup_metadata(item, metadata_by_key)
        year = _metadata_year(metadata) or _year_from_torrent_name(str(item.get("name", "")))
        return bool(year) and is_media_wall_movie_candidate(item) and _is_recent_upload(item, now)
    if media_type == "series":
        return is_recent_series_update_candidate(item, _lookup_metadata(item, metadata_by_key), now)
    return False


def _quality_latest_items(
    torrents_by_source: Dict[str, List[Dict[str, Any]]],
    metadata_by_key: Dict[str, Dict[str, Any]],
    now: datetime,
    limit: int,
    excluded_keys: Optional[Set[str]] = None,
) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
    excluded_keys = excluded_keys or set()
    strict_cards: List[Dict[str, Any]] = []
    relaxed_cards: List[Dict[str, Any]] = []
    for item in [
        *_dict_items(torrents_by_source.get("latest", [])),
        *_dict_items(torrents_by_source.get("movies", [])),
        *_dict_items(torrents_by_source.get("series", [])),
    ]:
        if not _is_quality_latest_candidate(item, metadata_by_key, now):
            continue
        reason = "近期 4K 影视补充" if has_4k_quality(item) else "近期高质量影视补充"
        card = _to_media_card(item, metadata_by_key, reason)
        if _card_key(card) in excluded_keys:
            continue
        if has_4k_quality(card):
            strict_cards.append(card)
        elif _has_high_quality_1080p(card):
            relaxed_cards.append(card)
    cards = [*_sort_home_cards(strict_cards), *_sort_home_cards(relaxed_cards)]
    cards = _dedupe_cards(cards)[:limit]
    return cards, _rail_counts(cards, strict_label="strict", relaxed_label="fallback")


def _is_popular_media_candidate(
    item: Dict[str, Any],
    metadata_by_key: Dict[str, Dict[str, Any]],
    now: datetime,
) -> bool:
    if not _has_quality_for_relaxed_fill(item):
        return False
    media_type = classify_media_type(item)
    if media_type == "movie":
        return (
            bool(_year_from_torrent_name(str(item.get("name", ""))))
            and is_media_wall_movie_candidate(item)
        )
    if media_type == "series":
        metadata = _lookup_metadata(item, metadata_by_key)
        return is_recent_series_update_candidate(item, metadata, now)
    return False


def _popular_media_items(
    torrents_by_source: Dict[str, List[Dict[str, Any]]],
    metadata_by_key: Dict[str, Dict[str, Any]],
    now: datetime,
    limit: int,
    excluded_keys: Optional[Set[str]] = None,
) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
    excluded_keys = excluded_keys or set()
    cards: List[Dict[str, Any]] = []
    for item in [
        *_dict_items(torrents_by_source.get("hot", [])),
        *_dict_items(torrents_by_source.get("latest", [])),
        *_dict_items(torrents_by_source.get("movies", [])),
        *_dict_items(torrents_by_source.get("series", [])),
    ]:
        if not _is_popular_media_candidate(item, metadata_by_key, now):
            continue
        card = _to_media_card(item, metadata_by_key, "热门高质量影视资源")
        if _card_key(card) in excluded_keys:
            continue
        cards.append(card)
    ranked = sorted(
        cards,
        key=lambda card: (
            _safe_int(card.get("seeders")),
            _safe_int(card.get("leechers")),
            _safe_int(card.get("times_completed")),
            _quality_score(card),
            _created_timestamp(card),
        ),
        reverse=True,
    )
    cards = _dedupe_cards(ranked)[:limit]
    return cards, _rail_counts(cards, strict_label="strict", relaxed_label="fallback")

def _to_media_card(
    torrent: Dict[str, Any],
    metadata_by_key: Dict[str, Dict[str, Any]],
    rail_reason: str,
) -> Dict[str, Any]:
    metadata = _lookup_metadata(torrent, metadata_by_key)
    status = torrent.get("status") or {}
    media_type = classify_media_type(torrent)
    torrent_name = str(torrent.get("name", ""))
    title = str(metadata.get("title") or _title_from_torrent_name(torrent_name))
    year = str(metadata.get("year") or "")
    episode = extract_series_token(torrent)
    quality_tags = extract_quality_tags(torrent_name)
    created_date = str(torrent.get("createdDate") or "")

    return {
        "id": str(torrent.get("id", "")),
        "media_key": _media_key(torrent),
        "title": title,
        "torrent_name": torrent_name,
        "poster_url": _metadata_poster_url(metadata) or _torrent_poster_url(torrent),
        "detail_url": f"{MT_SITE_URL}/detail/{torrent.get('id', '')}",
        "year": year,
        "media_type": media_type,
        "episode": episode,
        "quality_tags": quality_tags,
        "rail_reason": rail_reason,
        "created_date": created_date,
        "size": _safe_int(torrent.get("size")),
        "size_display": format_size(_safe_int(torrent.get("size"))),
        "seeders": _safe_int(status.get("seeders")),
        "leechers": _safe_int(status.get("leechers")),
        "times_completed": _safe_int(status.get("timesCompleted")),
        "discount": str(status.get("discount") or "NORMAL"),
        "douban": torrent.get("douban"),
        "imdb": torrent.get("imdb"),
        "douban_rating": torrent.get("doubanRating"),
        "imdb_rating": torrent.get("imdbRating"),
        "description": metadata.get("intro") or torrent.get("smallDescr"),
    }


def _dedupe_cards(cards: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: Set[str] = set()
    result = []
    for card in cards:
        key = _card_key(card)
        if key in seen:
            continue
        seen.add(key)
        result.append(card)
    return result


def _card_keys(cards: List[Dict[str, Any]]) -> Set[str]:
    return {_card_key(card) for card in cards}


def _card_key(card: Dict[str, Any]) -> str:
    key = str(card.get("media_key") or "")
    if key.startswith("douban:"):
        return f"douban:{_normalize_douban_code(key.removeprefix('douban:'))}"
    if key.startswith("imdb:"):
        return f"imdb:{_normalize_imdb_code(key.removeprefix('imdb:'))}"
    return key or str(card.get("id"))


def _lookup_metadata(
    torrent: Dict[str, Any],
    metadata_by_key: Dict[str, Dict[str, Any]],
) -> Dict[str, Any]:
    for key in _metadata_keys(torrent):
        if key in metadata_by_key:
            return metadata_by_key[key]
    return {}


def _metadata_keys(torrent: Dict[str, Any]) -> List[str]:
    keys = []
    douban = torrent.get("douban")
    if douban:
        value = str(douban)
        normalized = _normalize_douban_code(value)
        keys.extend([value, f"douban:{value}", normalized, f"douban:{normalized}"])

    imdb = torrent.get("imdb")
    if imdb:
        value = str(imdb)
        normalized = _normalize_imdb_code(value)
        keys.extend([value, f"imdb:{value}", normalized, f"imdb:{normalized}"])

    torrent_id = torrent.get("id")
    if torrent_id:
        keys.append(f"torrent:{torrent_id}")
    return keys


def _media_key(torrent: Dict[str, Any]) -> str:
    douban = torrent.get("douban")
    if douban:
        return f"douban:{_normalize_douban_code(str(douban))}"

    imdb = torrent.get("imdb")
    if imdb:
        return f"imdb:{_normalize_imdb_code(str(imdb))}"

    return f"title:{_title_from_torrent_name(str(torrent.get('name', ''))).lower()}"


def _metadata_year(metadata: Dict[str, Any]) -> Optional[int]:
    raw = metadata.get("year")
    if raw is None:
        return None
    match = re.search(r"\d{4}", str(raw))
    return int(match.group(0)) if match else None


def _metadata_poster_url(metadata: Dict[str, Any]) -> Optional[str]:
    for field_name in ("coverUrl", "photo", "posterUrl", "poster", "image"):
        value = metadata.get(field_name)
        if isinstance(value, str) and value.strip():
            return value
    return None


def _torrent_poster_url(torrent: Dict[str, Any]) -> Optional[str]:
    for field_name in ("imageList", "images", "image_list"):
        value = torrent.get(field_name)
        poster_url = _poster_url_from_value(value)
        if poster_url:
            return poster_url
    return None


def _poster_url_from_value(value: Any) -> Optional[str]:
    if isinstance(value, str):
        return _normalize_poster_url(value)
    if isinstance(value, dict):
        for key in ("url", "image", "src", "poster", "coverUrl"):
            poster_url = _poster_url_from_value(value.get(key))
            if poster_url:
                return poster_url
        return None
    if isinstance(value, list):
        for item in value:
            poster_url = _poster_url_from_value(item)
            if poster_url:
                return poster_url
    return None


def _year_from_torrent_name(name: str) -> Optional[int]:
    match = re.search(r"\b((?:19|20)\d{2})\b", name)
    return int(match.group(1)) if match else None


def _chinese_number_to_int(value: str) -> Optional[int]:
    if value.isdigit():
        return int(value)

    digits = {
        "一": 1,
        "二": 2,
        "三": 3,
        "四": 4,
        "五": 5,
        "六": 6,
        "七": 7,
        "八": 8,
        "九": 9,
    }
    if value == "十":
        return 10
    if value.startswith("十"):
        suffix = value[1:]
        return 10 + digits.get(suffix, 0)
    if "十" in value:
        prefix, suffix = value.split("十", 1)
        return digits.get(prefix, 0) * 10 + digits.get(suffix, 0)
    return digits.get(value)


def _title_from_torrent_name(name: str) -> str:
    title = re.split(
        r"\b(?:19|20)\d{2}\b|\b(?:2160p|1080p|720p|BluRay|WEB[-_. ]?DL|REMUX|HEVC|x265|x264)\b",
        name,
        maxsplit=1,
        flags=re.IGNORECASE,
    )[0]
    title = re.sub(r"[._]+", " ", title).strip(" -")
    return title or name


def _dict_items(items: Any) -> List[Dict[str, Any]]:
    if not isinstance(items, list):
        return []
    return [item for item in items if isinstance(item, dict)]


def _flatten_sources(torrents_by_source: Dict[str, List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    seen: Set[str] = set()
    flattened = []
    source_items = [_dict_items(items) for items in torrents_by_source.values()]
    max_length = max((len(items) for items in source_items), default=0)
    for index in range(max_length):
        for items in source_items:
            if index >= len(items):
                continue
            item = items[index]
            torrent_id = str(item.get("id", ""))
            if torrent_id and torrent_id in seen:
                continue
            if torrent_id:
                seen.add(torrent_id)
            flattened.append(item)
    return flattened


def _metadata_sources(torrent: Dict[str, Any]) -> List[tuple]:
    sources = []
    douban = torrent.get("douban")
    if douban:
        value = str(douban)
        normalized = _normalize_douban_code(value)
        sources.append(
            (
                f"douban:{normalized}",
                [value, f"douban:{value}", normalized],
                "douban",
                normalized,
            )
        )
    imdb = torrent.get("imdb")
    if imdb:
        value = str(imdb)
        normalized = _normalize_imdb_code(value)
        sources.append(
            (
                f"imdb:{normalized}",
                [value, f"imdb:{value}", normalized],
                "imdb",
                normalized,
            )
        )
    return sources


async def fetch_douban_poster_from_page(code: str) -> Optional[str]:
    """Fetch a poster URL from a Douban subject page without using an official API."""
    normalized_code = _normalize_douban_code(code)
    if not re.fullmatch(r"\d{5,12}", normalized_code):
        return None

    url = f"https://movie.douban.com/subject/{normalized_code}/"
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Referer": "https://movie.douban.com/",
    }
    try:
        client = await get_http_client()
        response = await client.get(url, headers=headers, follow_redirects=True)
    except Exception as exc:
        logger.debug("豆瓣海报页面请求失败 (%s): %s", normalized_code, exc)
        return None

    if response.status_code >= 400:
        logger.debug("豆瓣海报页面返回异常 (%s): HTTP %s", normalized_code, response.status_code)
        return None
    return extract_douban_poster_url(response.text)


def extract_douban_poster_url(html: str) -> Optional[str]:
    """Extract a poster image from a Douban subject HTML page."""
    for tag in re.findall(r"<meta\b[^>]*>", html or "", flags=re.IGNORECASE | re.DOTALL):
        attrs = _html_attrs(tag)
        key = (attrs.get("property") or attrs.get("name") or "").lower()
        if key in {"og:image", "og:image:secure_url", "twitter:image"}:
            poster_url = _normalize_poster_url(attrs.get("content"))
            if poster_url:
                return poster_url

    for script in re.findall(
        r"<script\b[^>]*type=[\"']application/ld\+json[\"'][^>]*>(.*?)</script>",
        html or "",
        flags=re.IGNORECASE | re.DOTALL,
    ):
        try:
            payload = json.loads(unescape(script.strip()))
        except json.JSONDecodeError:
            continue
        poster_url = _poster_url_from_json_ld(payload)
        if poster_url:
            return poster_url

    return None


def _html_attrs(tag: str) -> Dict[str, str]:
    return {
        key.lower(): unescape(value).replace("\\/", "/")
        for key, _quote, value in re.findall(
            r"([\w:-]+)\s*=\s*([\"'])(.*?)\2",
            tag,
            flags=re.DOTALL,
        )
    }


def _poster_url_from_json_ld(value: Any) -> Optional[str]:
    if isinstance(value, str):
        return _normalize_poster_url(value)

    if isinstance(value, list):
        for item in value:
            poster_url = _poster_url_from_json_ld(item)
            if poster_url:
                return poster_url
        return None

    if not isinstance(value, dict):
        return None

    image = value.get("image")
    if isinstance(image, str):
        return _normalize_poster_url(image)
    if isinstance(image, dict):
        return _normalize_poster_url(image.get("url") or image.get("@id"))
    if isinstance(image, list):
        return _poster_url_from_json_ld(image)
    return None


def _normalize_poster_url(value: Any) -> Optional[str]:
    if not value:
        return None
    text = unescape(str(value)).replace("\\/", "/").strip()
    if not re.match(r"https?://", text, flags=re.IGNORECASE):
        return None
    return text


def _normalize_douban_code(value: str) -> str:
    text = str(value).strip()
    match = re.search(r"(?:subject/)?(\d{5,12})", text)
    return match.group(1) if match else text


def _normalize_imdb_code(value: str) -> str:
    text = str(value).strip()
    match = re.search(r"(tt\d+)", text, flags=re.IGNORECASE)
    return match.group(1).lower() if match else text



def _lookup_cache_entry(
    cache: Dict[str, Any],
    keys: List[str],
) -> Optional[Dict[str, Any]]:
    for key in keys:
        entry = cache.get(key)
        if isinstance(entry, dict):
            return entry
    return None


def _store_metadata_aliases(
    metadata: Dict[str, Dict[str, Any]],
    keys: List[str],
    data: Dict[str, Any],
) -> None:
    seen: Set[str] = set()
    for key in keys:
        if not key or key in seen:
            continue
        seen.add(key)
        metadata[key] = data


def _is_recent_metadata_miss(
    cached: Optional[Dict[str, Any]],
    now: datetime,
    ttl_seconds: int,
) -> bool:
    if not cached:
        return False
    missed_at = _parse_datetime(cached.get("missed_at"))
    if not missed_at:
        return False
    return (now - missed_at).total_seconds() < ttl_seconds


def _is_fresh_cache_entry(
    cached: Optional[Dict[str, Any]],
    now: datetime,
    ttl_seconds: int,
) -> bool:
    if not cached or not cached.get("data"):
        return False
    fetched_at = _parse_datetime(cached.get("fetched_at"))
    if not fetched_at:
        return False
    return (now - fetched_at).total_seconds() < ttl_seconds


def _is_recent_douban_poster_attempt(
    cached: Optional[Dict[str, Any]],
    now: datetime,
    ttl_seconds: int,
) -> bool:
    if not cached:
        return False
    attempted_at = _parse_datetime(cached.get("douban_poster_attempted_at"))
    if not attempted_at:
        return False
    return (now - attempted_at).total_seconds() < ttl_seconds


def _parse_datetime(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=BEIJING_TZ)
    return parsed.astimezone(BEIJING_TZ)


def _read_json(path: Path) -> Optional[Dict[str, Any]]:
    try:
        if not path.exists():
            return None
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else None
    except Exception as exc:
        logger.warning("读取媒体墙缓存失败 %s: %s", path, exc)
        return None


def _write_json(path: Path, data: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    with tmp_path.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
    tmp_path.replace(path)


media_wall_service = MediaWallService()
