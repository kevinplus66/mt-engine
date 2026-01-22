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
