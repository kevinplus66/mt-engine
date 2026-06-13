import os
from types import SimpleNamespace

import pytest

os.environ["DEBUG"] = "true"

from app.models import SearchRequest
from app.routes import radar


class _Request:
    client = SimpleNamespace(host="127.0.0.1")


@pytest.mark.asyncio
async def test_api_radar_uses_shared_mteam_search_and_preserves_payload(monkeypatch):
    calls = []

    async def fake_search_torrents(payload, label="搜索种子"):
        calls.append((payload, label))
        return {
            "data": [
                {
                    "id": "12345",
                    "name": "Example Torrent",
                    "smallDescr": "A release",
                    "size": "1024",
                    "status": {
                        "seeders": "7",
                        "leechers": "2",
                        "discount": "FREE",
                        "discountEndTime": "2026-06-05T00:00:00Z",
                        "timesCompleted": "11",
                    },
                    "createdDate": "2026-06-04T00:00:00Z",
                    "standard": "1",
                    "videoCodec": "1",
                    "audioCodec": "1",
                    "source": "1",
                    "teamName": "MTeam",
                    "tags": "tagged",
                    "labelsNew": ["HDR"],
                    "imdb": "tt1234567",
                    "douban": "1234567",
                    "countries": "1",
                    "category": "401",
                }
            ],
            "total": 1,
        }

    monkeypatch.setattr(radar, "MT_TOKEN", "configured-token")
    monkeypatch.setattr(radar, "MT_SITE_URL", "https://kp.m-team.cc")
    monkeypatch.setattr(radar, "user_torrent_status", {"seeding": {}, "leeching": {}})
    monkeypatch.setattr(radar.mt_client, "search_torrents", fake_search_torrents)
    monkeypatch.setattr(radar.state, "COUNTRY_LABELS", {1: "United States of America"})

    request_data = SearchRequest(
        keyword="linux iso",
        mode="movie",
        categories=[401],
        standards=[1],
        videoCodecs=[1],
        audioCodecs=[1],
        sources=[1],
        countries=[1],
        discount="FREE",
        sortField="SIZE",
        sortDirection="ASC",
        pageNumber=2,
        pageSize=25,
    )

    result = await radar.api_radar(_Request(), request_data, lambda _ip: True, lambda _ip: True)

    assert calls == [
        (
            {
                "mode": "movie",
                "pageNumber": 2,
                "pageSize": 25,
                "keyword": "linux iso",
                "categories": [401],
                "standards": [1],
                "videoCodecs": [1],
                "audioCodecs": [1],
                "sources": [1],
                "countries": [1],
                "discount": "FREE",
                "sortField": "SIZE",
                "sortDirection": "ASC",
            },
            "雷达搜索",
        )
    ]
    assert not hasattr(radar, "get_http_client")
    assert not hasattr(radar, "get_headers")
    assert result["success"] is True
    assert result["total"] == 1
    assert result["pageNumber"] == 2
    assert result["pageSize"] == 25
    assert result["data"] == [
        {
            "id": "12345",
            "name": "Example Torrent",
            "small_descr": "A release",
            "size": 1024,
            "size_display": "1.02 KB",
            "seeders": 7,
            "leechers": 2,
            "discount": "FREE",
            "discount_label": {"zh": "免费", "en": "Free"},
            "discount_end_time": "2026-06-05T00:00:00Z",
            "created_date": "2026-06-04T00:00:00Z",
            "detail_url": "https://kp.m-team.cc/detail/12345",
            "user_status": "none",
            "category": "401",
            "quality_metadata": {
                "standard": "1080p",
                "video_codec": "H.264",
                "audio_codec": "FLAC",
                "source": "Bluray",
                "team_name": "MTeam",
                "times_completed": 11,
                "tags": "tagged",
                "labels_new": ["HDR"],
                "imdb": "tt1234567",
                "douban": "1234567",
                "country": "美国",
            },
        }
    ]


@pytest.mark.asyncio
async def test_api_radar_returns_failure_shape_when_shared_search_fails(monkeypatch):
    calls = []

    async def fake_search_torrents(payload, label="搜索种子"):
        calls.append((payload, label))
        return {}

    monkeypatch.setattr(radar, "MT_TOKEN", "configured-token")
    monkeypatch.setattr(radar.mt_client, "search_torrents", fake_search_torrents)

    request_data = SearchRequest(keyword="linux iso", pageNumber=3, pageSize=10)

    result = await radar.api_radar(_Request(), request_data, lambda _ip: True, lambda _ip: True)

    assert calls == [
        (
            {
                "mode": "normal",
                "pageNumber": 3,
                "pageSize": 10,
                "keyword": "linux iso",
                "sortField": "CREATED_DATE",
                "sortDirection": "DESC",
            },
            "雷达搜索",
        )
    ]
    assert not hasattr(radar, "get_http_client")
    assert not hasattr(radar, "get_headers")
    assert result == {"success": False, "message": "搜索失败", "data": [], "total": 0}
