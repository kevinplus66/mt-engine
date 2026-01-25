"""
Pydantic 请求模型
"""

import re
from typing import List, Literal
from pydantic import BaseModel, Field, field_validator


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


class RuleConfig(BaseModel):
    """Rule configuration for filtering and scoring torrents"""
    # Basic filtering
    min_size_gb: float = Field(20.0, ge=0)
    max_size_gb: float = Field(500.0, ge=0)
    discount_types: List[str] = ["FREE", "_2X_FREE"]
    include_keywords: List[str] = []
    exclude_keywords: List[str] = []

    # Advanced filtering (0 = no limit)
    max_seeders: int = Field(10, ge=0)  # Maximum seeders allowed
    min_leechers: int = Field(100, ge=0)  # Minimum leechers required

    # Scoring weights (bounded to prevent extreme values)
    weight_size: float = Field(0.0, ge=-10, le=10)
    weight_free_time: float = Field(0.0, ge=-10, le=10)
    weight_age: float = Field(0.0, ge=-10, le=10)
    weight_seeders: float = Field(0.0, ge=-10, le=10)


class DownloadPolicy(BaseModel):
    """Download policy configuration"""
    enabled: bool = True
    max_active_tasks: int = Field(20, ge=1, le=50)
    interval_seconds: int = Field(300, ge=60)
    save_path: str = "/downloads/mt_free_farm"
    disk_usage_threshold: float = Field(0.90, ge=0.5, le=0.95)
    rules: RuleConfig = Field(default_factory=RuleConfig)


class CleanupPolicy(BaseModel):
    """Cleanup policy configuration"""
    enabled: bool = True
    min_share_ratio: float = Field(0.0, ge=0)
    min_seed_time_hours: int = Field(1, ge=0)  # H&R protection
    max_download_time_hours: int = Field(12, ge=0)  # Zombie task timeout

    # Bottom performers elimination
    min_current_users: int = Field(10, ge=0)  # Delete if seeders + leechers < this (from qB tracker)
    min_upload_speed_kbps: int = Field(300, ge=0)  # Min average upload speed (KB/s)
    elimination_ratio: float = Field(0.2, ge=0.0, le=0.5)  # Delete slowest X% PILOT tasks each cleanup cycle


class AutomationConfig(BaseModel):
    """Main pilot configuration (credentials via env vars, not stored)"""
    download: DownloadPolicy = Field(default_factory=DownloadPolicy)
    cleanup: CleanupPolicy = Field(default_factory=CleanupPolicy)
    enable_notification: bool = True
