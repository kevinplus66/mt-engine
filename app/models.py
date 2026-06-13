"""
Pydantic 请求模型
"""

import posixpath
import re
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, field_validator


def normalize_download_save_path(value: str) -> str:
    """Normalize and restrict qBittorrent download paths to /downloads."""
    if not isinstance(value, str):
        raise ValueError("save_path must be a string")

    raw_path = value.strip()
    if not raw_path:
        raise ValueError("save_path must not be empty")

    normalized = posixpath.normpath(raw_path)
    if normalized == ".":
        raise ValueError("save_path must not be empty")

    if normalized != "/downloads" and not normalized.startswith("/downloads/"):
        raise ValueError("save_path must be /downloads or a descendant")

    return normalized


class DownloadRequest(BaseModel):
    """Request model for torrent download"""
    id: str = Field(..., min_length=1, max_length=20)

    @field_validator('id')
    @classmethod
    def validate_torrent_id(cls, v: str) -> str:
        """Validate torrent ID is numeric only"""
        if not re.match(r'^\d+$', v):
            raise ValueError('Invalid torrent ID format')
        return v


class AutoDeleteToggleRequest(BaseModel):
    """Request model for auto-delete toggle (idempotent set)"""
    enabled: bool


class PanelTrafficSummary(BaseModel):
    """Traffic summary for M-Team or qBittorrent counters"""
    uploaded: int = 0
    downloaded: int = 0
    uploaded_display: Optional[str] = None
    downloaded_display: Optional[str] = None
    upload_speed: int = 0
    download_speed: int = 0


class PanelUserSummary(BaseModel):
    """User-level PANEL stats"""
    share_ratio: float = 0
    uploaded: int = 0
    downloaded: int = 0
    uploaded_display: Optional[str] = None
    downloaded_display: Optional[str] = None
    bonus: Optional[float] = None
    seeding_count: int = 0
    leeching_count: int = 0
    user_level: Optional[str] = None


class PanelStorageInfo(BaseModel):
    """qBittorrent storage summary"""
    total: Optional[int] = None
    used: Optional[int] = None
    free: Optional[int] = None
    percent: Optional[float] = None
    total_display: Optional[str] = None
    used_display: Optional[str] = None
    free_display: Optional[str] = None
    save_path: Optional[str] = None
    error: Optional[str] = None


class PanelAverageSpeeds(BaseModel):
    """Average speeds calculated from local PANEL history"""
    upload_30min: int = 0
    download_30min: int = 0
    upload_display: str = "0 B/s"
    download_display: str = "0 B/s"


class PanelStatsResponse(BaseModel):
    """PANEL stats response"""
    mteam: PanelTrafficSummary = Field(default_factory=PanelTrafficSummary)
    qbittorrent: PanelTrafficSummary = Field(default_factory=PanelTrafficSummary)
    user: PanelUserSummary = Field(default_factory=PanelUserSummary)
    storage: Optional[PanelStorageInfo] = None
    avg_speeds: Optional[PanelAverageSpeeds] = None
    last_update: int


class PanelMetricPoint(BaseModel):
    """Cumulative upload/download point"""
    uploaded: int = 0
    downloaded: int = 0


class PanelTrafficDataPoint(BaseModel):
    """Traffic history point"""
    timestamp: int
    mteam: PanelMetricPoint = Field(default_factory=PanelMetricPoint)
    qbittorrent: PanelMetricPoint = Field(default_factory=PanelMetricPoint)


class PanelHistoryResponse(BaseModel):
    """PANEL traffic history response"""
    range: Literal["1h", "6h", "12h", "24h", "7d", "30d"]
    aggregation: str = "none"
    data_points: List[PanelTrafficDataPoint] = Field(default_factory=list)
    error: Optional[str] = None


class PanelShareRatioDataPoint(BaseModel):
    """Share-ratio history point"""
    timestamp: int
    share_ratio: float = 0


class PanelShareRatioResponse(BaseModel):
    """PANEL share-ratio history response"""
    range: Literal["1h", "6h", "12h", "24h", "7d", "30d"]
    data_points: List[PanelShareRatioDataPoint] = Field(default_factory=list)
    current: float = 0
    highest: float = 0
    lowest: float = 0
    change_24h: float = 0
    error: Optional[str] = None


class PanelTorrentHealth(BaseModel):
    """PANEL torrent health summary"""
    score: int = 0
    status: str = ""
    reason: str = ""


class PanelTorrentItem(BaseModel):
    """qBittorrent torrent item displayed by PANEL"""
    id: Optional[str] = None
    hash: str = ""
    name: str = ""
    size: int = 0
    size_display: str = ""
    progress: float = 0
    status: str = ""
    tags: List[str] = Field(default_factory=list)
    ratio: float = 0
    uploaded: int = 0
    downloaded: int = 0
    upload_speed: int = 0
    download_speed: int = 0
    seeders: int = 0
    leechers: int = 0
    added_on: int = 0
    eta: Optional[int] = None
    health: PanelTorrentHealth = Field(default_factory=PanelTorrentHealth)
    mteam_id: Optional[str] = None
    quality_metadata: Optional[Dict[str, Any]] = None


class PanelTorrentsResponse(BaseModel):
    """PANEL torrent list response"""
    torrents: List[PanelTorrentItem] = Field(default_factory=list)
    total_count: int = 0
    filtered_count: int = 0
    error: Optional[str] = None


class PanelPauseTorrentsResponse(BaseModel):
    """Batch pause response"""
    success: bool
    paused_count: int = 0
    failed: List[str] = Field(default_factory=list)
    error: Optional[str] = None


class PanelResumeTorrentsResponse(BaseModel):
    """Batch resume response"""
    success: bool
    resumed_count: int = 0
    failed: List[str] = Field(default_factory=list)
    error: Optional[str] = None


class PanelDeleteTorrentsResponse(BaseModel):
    """Batch delete response"""
    success: bool
    deleted_count: int = 0
    failed: List[str] = Field(default_factory=list)
    error: Optional[str] = None


class SearchRequest(BaseModel):
    """Request model for torrent search"""
    keyword: str = Field("", max_length=100)
    mode: Literal["normal", "adult", "movie", "tvshow", "other"] = Field("normal")
    categories: List[int] = Field(default_factory=list)
    standards: List[int] = Field(default_factory=list)
    videoCodecs: List[int] = Field(default_factory=list)
    audioCodecs: List[int] = Field(default_factory=list)
    sources: List[int] = Field(default_factory=list)
    countries: List[int] = Field(default_factory=list)
    discount: str = Field("")
    sortField: str = Field("CREATED_DATE")
    sortDirection: str = Field("DESC")
    pageNumber: int = Field(1, ge=1)
    pageSize: int = Field(50, ge=1, le=200)


class CacheStatus(BaseModel):
    """Runtime cache status exposed by /api/status"""
    last_update: Optional[str] = None
    last_success: Optional[str] = None
    next_refresh: Optional[str] = None
    age_seconds: Optional[float] = None
    stale: bool = False
    stale_after_seconds: int = 0
    total: int = 0
    error: Optional[str] = None
    last_error: Optional[str] = None


class PanelCollectorStatus(BaseModel):
    """PANEL collector heartbeat exposed by /api/status"""
    last_started: Optional[str] = None
    last_success: Optional[str] = None
    last_error: Optional[str] = None
    last_duration_seconds: Optional[float] = None
    next_refresh: Optional[str] = None
    heartbeat_age_seconds: Optional[float] = None
    stale: bool = False
    stale_after_seconds: int = 0


class DependencyStatusResponse(BaseModel):
    """External dependency status exposed by /api/status"""
    name: str
    ok: bool
    last_success: Optional[str] = None
    last_error: Optional[str] = None


class RuntimeConfigStatus(BaseModel):
    """Non-secret runtime configuration summary"""
    debug: bool
    refresh_interval_seconds: int
    panel_collect_interval_seconds: int
    media_wall_refresh_interval_seconds: int = 0
    media_wall_startup_delay_seconds: int = 0
    media_wall_source_stagger_seconds: int = 0
    media_wall_douban_poster_fetches: int = 0
    api_delay_seconds: float
    qbittorrent_configured: bool
    mteam_token_configured: bool
    mteam_user_configured: bool


class ApiStatusResponse(BaseModel):
    """Runtime status response"""
    status: str
    version: str
    commit: str
    timestamp: str
    cache: CacheStatus
    panel_collector: PanelCollectorStatus
    dependencies: Dict[str, DependencyStatusResponse]
    config: RuntimeConfigStatus
    warnings: List[str] = []


class MediaWallItem(BaseModel):
    """Single read-only item displayed in the Home media wall"""
    id: str
    media_key: str
    title: str
    torrent_name: str
    poster_url: Optional[str] = None
    detail_url: str = ""
    year: str = ""
    media_type: Literal["movie", "series", "other"]
    episode: Optional[str] = None
    quality_tags: List[str] = Field(default_factory=list)
    rail_reason: str = ""
    created_date: str = ""
    size: int = 0
    size_display: str = ""
    seeders: int = 0
    leechers: int = 0
    times_completed: int = 0
    discount: str = "NORMAL"
    douban: Optional[str] = None
    imdb: Optional[str] = None
    douban_rating: Optional[Any] = None
    imdb_rating: Optional[Any] = None
    description: Optional[str] = None


class MediaWallRail(BaseModel):
    """A horizontal Home media rail"""
    id: Literal[
        "western_series",
        "foreign_movies",
        "asian_series",
        "chinese_series",
        "classic_restorations",
        "quality_latest",
        "popular_media",
    ]
    title: str
    description: str = ""
    items: List[MediaWallItem] = Field(default_factory=list)


class MediaWallResponse(BaseModel):
    """Read-only cached Home media wall snapshot"""
    last_refreshed: Optional[str] = None
    next_refresh: Optional[str] = None
    stale: bool = True
    refresh_status: Literal["ok", "empty", "error"] = "empty"
    last_error: Optional[str] = None
    rails: List[MediaWallRail] = Field(default_factory=list)
    diagnostics: Optional[Dict[str, Any]] = None


class RuleConfig(BaseModel):
    """Rule configuration for filtering and scoring torrents"""
    # Basic filtering
    min_size_gb: float = Field(20.0, ge=0)
    max_size_gb: float = Field(500.0, ge=0)
    discount_types: List[str] = ["FREE", "_2X_FREE"]
    include_keywords: List[str] = []
    exclude_keywords: List[str] = ["AUDIOBOOK"]

    # Advanced filtering (0 = no limit)
    max_seeders: int = Field(10, ge=0)  # Maximum seeders allowed
    min_leechers: int = Field(100, ge=0)  # Minimum leechers required

    # Scoring weights (bounded to prevent extreme values)
    # Negative weight_size = prefer larger files
    weight_size: float = Field(-1.0, ge=-10, le=10)
    weight_free_time: float = Field(0.4, ge=-10, le=10)
    weight_age: float = Field(0.5, ge=-10, le=10)
    weight_seeders: float = Field(3.0, ge=-10, le=10)  # Upload-window weight


class DownloadPolicy(BaseModel):
    """Download policy configuration"""
    enabled: bool = True
    max_active_tasks: int = Field(20, ge=1, le=50)
    interval_seconds: int = Field(300, ge=60)
    save_path: str = Field(default="/downloads/mt_free_farm")
    disk_usage_threshold: int = Field(90, ge=50, le=95)  # 百分比 50-95%
    rules: RuleConfig = Field(default_factory=RuleConfig)

    @field_validator('save_path')
    @classmethod
    def validate_save_path(cls, v: str) -> str:
        return normalize_download_save_path(v)


class CleanupPolicy(BaseModel):
    """Cleanup policy configuration"""
    enabled: bool = True
    min_share_ratio: float = Field(0.0, ge=0)
    min_seed_time_hours: int = Field(1, ge=0)  # H&R protection
    max_download_time_hours: int = Field(12, ge=0)  # Zombie task timeout

    # Dead seed detection
    dead_seed_minutes: int = Field(30, ge=5)
    dead_seed_max_ratio: float = Field(0.01, ge=0)

    # Bottom performers elimination
    min_current_users: int = Field(5, ge=0)  # Delete if seeders + leechers < this (from qB tracker)
    min_upload_speed_kbps: int = Field(200, ge=0)  # Min average upload speed (KB/s)
    elimination_ratio: int = Field(0, ge=0, le=50)  # Eliminate lowest 0% by score (disabled by default)


class AutomationConfig(BaseModel):
    """Main pilot configuration (credentials via env vars, not stored)"""
    download: DownloadPolicy = Field(default_factory=DownloadPolicy)
    cleanup: CleanupPolicy = Field(default_factory=CleanupPolicy)
    enable_notification: bool = True
