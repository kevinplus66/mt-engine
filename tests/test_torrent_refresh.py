from types import SimpleNamespace
from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException

import app.state as state
from app.models import SearchRequest
from app.config import BEIJING_TZ
from app.core import torrent
from app.services import mteam_api
from app.routes import radar, torrents as torrent_routes
from app.services.mteam_api import (
    CategoryFetchResult,
    FreeTorrentSearchResult,
    MTClient,
    UserTorrentStatusResult,
)
from app.services.runtime_status import runtime_status


@pytest.fixture(autouse=True)
def reset_refresh_state(monkeypatch):
    original_cached_data = state.cached_data
    original_user_status = state.user_torrent_status
    original_user_profile = state.user_profile
    original_last_hour = state._last_user_status_refresh_hour
    original_categories_refresh = state._last_categories_refresh
    original_lock = torrent._refresh_lock

    state.cached_data = {
        "torrents": [],
        "categories": [],
        "last_update": None,
        "error": None,
    }
    state.user_torrent_status = {"seeding": {}, "leeching": {}}
    state.user_profile = {
        "share_ratio": 0,
        "uploaded": 0,
        "downloaded": 0,
        "uploaded_display": "0 B",
        "downloaded_display": "0 B",
    }
    state._last_user_status_refresh_hour = int(torrent.time.time()) // 3600
    state._last_categories_refresh = datetime.now(BEIJING_TZ)
    torrent._refresh_lock = None
    runtime_status.reset()

    monkeypatch.setattr(torrent, "MT_TOKEN", "token")
    monkeypatch.setattr(torrent, "API_DELAY", 0)

    async def no_sleep(_delay):
        return None

    monkeypatch.setattr(torrent.asyncio, "sleep", no_sleep)
    monkeypatch.setattr(torrent.random, "uniform", lambda *_args: 0)

    yield

    state.cached_data = original_cached_data
    state.user_torrent_status = original_user_status
    state.user_profile = original_user_profile
    state._last_user_status_refresh_hour = original_last_hour
    state._last_categories_refresh = original_categories_refresh
    torrent._refresh_lock = original_lock
    runtime_status.reset()


def _raw_torrent(torrent_id: str, discount: str = "FREE") -> dict:
    return {
        "id": torrent_id,
        "name": f"Torrent {torrent_id}",
        "size": 1024,
        "status": {"discount": discount, "seeders": 1, "leechers": 0},
    }


class _RefreshClient:
    def __init__(
        self,
        results,
        user_status_result=None,
        categories_result=None,
    ):
        self.results = results
        self.calls = []
        self.user_status_result = user_status_result or UserTorrentStatusResult(
            statuses={"seeding": {}, "leeching": {}},
            succeeded=True,
        )
        self.categories_result = categories_result or CategoryFetchResult(
            categories=[],
            succeeded=True,
        )

    async def search_free_torrents_page_one_with_status(
        self,
        discount_type="FREE",
        mode="normal",
        sort_field=None,
        sort_direction=None,
    ):
        self.calls.append((discount_type, mode, sort_field, sort_direction))
        key = (discount_type, mode, sort_field, sort_direction)
        if key in self.results:
            return self.results[key]
        if sort_field:
            return FreeTorrentSearchResult(
                items=[],
                succeeded=True,
                complete=True,
                pages_fetched=1,
                total=0,
            )
        return self.results[(discount_type, mode)]

    async def search_free_torrents_with_status(
        self,
        discount_type="FREE",
        mode="normal",
    ):
        return await self.search_free_torrents_page_one_with_status(discount_type, mode=mode)

    async def fetch_user_torrent_status_with_status(self):
        return self.user_status_result

    async def fetch_user_profile(self):
        return None

    async def fetch_categories_with_status(self):
        return self.categories_result

    async def fetch_categories(self):
        return self.categories_result.categories


@pytest.mark.asyncio
async def test_failed_user_status_refresh_keeps_previous_status_cache(monkeypatch):
    previous_status = {
        "seeding": {"seed-old": {"id": "seed-old"}},
        "leeching": {"leech-old": {"id": "leech-old"}},
    }
    state.user_torrent_status = previous_status
    previous_hour = int(torrent.time.time()) // 3600 - 1
    state._last_user_status_refresh_hour = previous_hour
    client = _RefreshClient(
        {
            ("FREE", "normal"): FreeTorrentSearchResult(
                items=[_raw_torrent("new-normal")],
                succeeded=True,
                complete=True,
                pages_fetched=1,
                total=1,
            ),
            ("FREE", "adult"): FreeTorrentSearchResult(
                items=[],
                succeeded=True,
                complete=True,
                pages_fetched=1,
                total=0,
            ),
        },
        user_status_result=UserTorrentStatusResult(
            statuses={"seeding": {}, "leeching": {}},
            succeeded=False,
            error="status timeout",
        ),
    )

    monkeypatch.setattr(torrent, "mt_client", client)
    import app.core.alerts as alerts

    async def fake_check_emergency_alerts(*_args, **_kwargs):
        return None

    monkeypatch.setattr(alerts, "check_emergency_alerts", fake_check_emergency_alerts)

    await torrent.fetch_all_free_torrents()

    assert state.user_torrent_status is previous_status
    assert state.user_torrent_status == previous_status
    assert state._last_user_status_refresh_hour == previous_hour


@pytest.mark.asyncio
async def test_empty_category_refresh_keeps_previous_categories_and_retry_timestamp(monkeypatch):
    previous_categories = [{"id": 1, "name": "Movie"}]
    previous_refresh = datetime.now(BEIJING_TZ) - timedelta(
        hours=torrent.CATEGORIES_CACHE_HOURS + 1
    )
    state.cached_data = {
        "torrents": [{"id": "existing", "name": "Existing"}],
        "categories": previous_categories,
        "last_update": "2026-06-01 00:00:00",
        "error": None,
        "total": 1,
    }
    state._last_categories_refresh = previous_refresh
    client = _RefreshClient(
        {
            ("FREE", "normal"): FreeTorrentSearchResult(
                items=[_raw_torrent("new-normal")],
                succeeded=True,
                complete=True,
                pages_fetched=1,
                total=1,
            ),
            ("FREE", "adult"): FreeTorrentSearchResult(
                items=[],
                succeeded=True,
                complete=True,
                pages_fetched=1,
                total=0,
            ),
        },
        categories_result=CategoryFetchResult(
            categories=[],
            succeeded=True,
        ),
    )

    monkeypatch.setattr(torrent, "mt_client", client)
    import app.core.alerts as alerts

    async def fake_check_emergency_alerts(*_args, **_kwargs):
        return None

    monkeypatch.setattr(alerts, "check_emergency_alerts", fake_check_emergency_alerts)

    result = await torrent.fetch_all_free_torrents()

    assert result["categories"] == previous_categories
    assert state._last_categories_refresh == previous_refresh


class _RouteRequest:
    client = SimpleNamespace(host="127.0.0.1")


@pytest.mark.parametrize(
    ("refresh_result", "expected_detail"),
    [
        ({"error": "normal shard failed"}, "normal shard failed"),
        (
            {
                "error": None,
                "free_refresh_backoff_until": "2026-06-25T00:00:00+08:00",
                "free_refresh_backoff_reason": "rate limited",
            },
            "rate limited",
        ),
    ],
)
@pytest.mark.asyncio
async def test_api_refresh_raises_when_fetch_reports_failure_or_backoff(
    monkeypatch, refresh_result, expected_detail
):
    calls = []

    async def fake_fetch_all_free_torrents():
        calls.append("fetch")
        return refresh_result

    monkeypatch.setattr(
        torrent_routes, "fetch_all_free_torrents", fake_fetch_all_free_torrents
    )

    with pytest.raises(HTTPException) as exc_info:
        await torrent_routes.api_refresh(_RouteRequest(), lambda _ip: True)

    assert exc_info.value.status_code == 502
    assert exc_info.value.detail == expected_detail
    assert calls == ["fetch"]


@pytest.mark.asyncio
async def test_api_radar_formats_missing_times_completed_as_zero(monkeypatch):
    async def fake_search_torrents(payload, label="雷达搜索"):
        return {
            "data": [
                {
                    "id": "radar-1",
                    "name": "Radar Torrent",
                    "size": "1024",
                    "status": {"timesCompleted": None},
                }
            ],
            "total": 1,
        }

    monkeypatch.setattr(radar, "MT_TOKEN", "configured-token")
    monkeypatch.setattr(
        radar, "user_torrent_status", {"seeding": {}, "leeching": {}}
    )
    monkeypatch.setattr(radar.mt_client, "search_torrents", fake_search_torrents)

    result = await radar.api_radar(
        _RouteRequest(), SearchRequest(), lambda _ip: True, lambda _ip: True
    )

    assert result["success"] is True
    assert result["data"][0]["quality_metadata"]["times_completed"] == 0


@pytest.mark.asyncio
async def test_failed_required_normal_shard_keeps_previous_cache_and_runs_expiry_only_emergencies(monkeypatch):
    previous_torrents = [{"id": "existing", "name": "Existing"}]
    state.cached_data = {
        "torrents": previous_torrents,
        "categories": [{"id": 1, "name": "Movie"}],
        "last_update": "2026-06-01 00:00:00",
        "error": None,
        "total": 1,
    }
    client = _RefreshClient(
        {
            ("FREE", "normal"): FreeTorrentSearchResult(
                items=[],
                succeeded=False,
                complete=False,
                pages_fetched=0,
                error="normal shard failed",
            ),
            ("FREE", "adult"): FreeTorrentSearchResult(
                items=[_raw_torrent("adult-1")],
                succeeded=True,
                complete=True,
                pages_fetched=1,
                total=1,
            ),
        }
    )
    emergency_calls = []

    async def fake_check_emergency_alerts(
        torrents, *, expiry_only=False, current_free_membership_complete=True
    ):
        emergency_calls.append((torrents, expiry_only, current_free_membership_complete))

    monkeypatch.setattr(torrent, "mt_client", client)
    import app.core.alerts as alerts

    monkeypatch.setattr(alerts, "check_emergency_alerts", fake_check_emergency_alerts)

    result = await torrent.fetch_all_free_torrents()

    assert result is state.cached_data
    assert state.cached_data["torrents"] == previous_torrents
    assert state.cached_data["total"] == 1
    assert state.cached_data["error"] == "normal shard failed"
    assert runtime_status.mteam.ok is False
    assert runtime_status.mteam.last_error == "normal shard failed"
    assert emergency_calls == [(previous_torrents, True, True)]
    assert state.cached_data["free_refresh_backoff_until"] is not None
    assert state.cached_data["free_refresh_backoff_reason"] == "normal shard failed"
    assert client.calls == [("FREE", "normal", None, None)]

    result = await torrent.fetch_all_free_torrents()

    assert result is state.cached_data
    assert client.calls == [("FREE", "normal", None, None)]
    assert emergency_calls == [
        (previous_torrents, True, True),
        (previous_torrents, True, True),
    ]

@pytest.mark.asyncio
async def test_failed_adult_shard_is_optional_and_normal_cache_still_updates(monkeypatch):
    client = _RefreshClient(
        {
            ("FREE", "normal"): FreeTorrentSearchResult(
                items=[_raw_torrent("new-normal")],
                succeeded=True,
                complete=True,
                pages_fetched=1,
                total=1,
            ),
            ("FREE", "adult"): FreeTorrentSearchResult(
                items=[],
                succeeded=False,
                complete=False,
                pages_fetched=0,
                error="adult shard failed",
            ),
        }
    )
    emergency_calls = []

    async def fake_check_emergency_alerts(
        torrents, *, expiry_only=False, current_free_membership_complete=True
    ):
        emergency_calls.append((torrents, expiry_only, current_free_membership_complete))

    monkeypatch.setattr(torrent, "mt_client", client)
    import app.core.alerts as alerts

    monkeypatch.setattr(alerts, "check_emergency_alerts", fake_check_emergency_alerts)

    result = await torrent.fetch_all_free_torrents()

    assert [t["id"] for t in result["torrents"]] == ["new-normal"]
    assert result["error"] is None
    assert result["free_refresh_backoff_until"] is None
    assert result["free_refresh_backoff_reason"] is None
    assert runtime_status.mteam.ok is True
    assert client.calls == [
        ("FREE", "normal", None, None),
        ("FREE", "normal", "LEECHERS", "DESC"),
        ("FREE", "adult", None, None),
        ("FREE", "adult", "LEECHERS", "DESC"),
    ]
    assert len(emergency_calls) == 1
    called_torrents, expiry_only, membership_complete = emergency_calls[0]
    assert [t["id"] for t in called_torrents] == ["new-normal"]
    assert expiry_only is False
    assert membership_complete is False


@pytest.mark.asyncio
async def test_page_one_free_search_updates_cache_and_checks_emergencies(monkeypatch):
    client = _RefreshClient(
        {
            ("FREE", "normal", None, None): FreeTorrentSearchResult(
                items=[_raw_torrent("page-1"), _raw_torrent("page-2")],
                succeeded=True,
                complete=False,
                pages_fetched=1,
                total=250,
            ),
            ("FREE", "normal", "LEECHERS", "DESC"): FreeTorrentSearchResult(
                items=[_raw_torrent("page-2"), _raw_torrent("demand-1")],
                succeeded=True,
                complete=False,
                pages_fetched=1,
                total=250,
            ),
            ("FREE", "adult", None, None): FreeTorrentSearchResult(
                items=[_raw_torrent("adult-1")],
                succeeded=True,
                complete=True,
                pages_fetched=1,
                total=1,
            ),
            ("FREE", "adult", "LEECHERS", "DESC"): FreeTorrentSearchResult(
                items=[],
                succeeded=True,
                complete=True,
                pages_fetched=1,
                total=0,
            ),
        }
    )
    emergency_calls = []

    async def fake_check_emergency_alerts(
        torrents, *, expiry_only=False, current_free_membership_complete=True
    ):
        emergency_calls.append((torrents, expiry_only, current_free_membership_complete))

    monkeypatch.setattr(torrent, "mt_client", client)
    import app.core.alerts as alerts

    monkeypatch.setattr(alerts, "check_emergency_alerts", fake_check_emergency_alerts)

    result = await torrent.fetch_all_free_torrents()

    assert result is state.cached_data
    assert client.calls == [
        ("FREE", "normal", None, None),
        ("FREE", "normal", "LEECHERS", "DESC"),
        ("FREE", "adult", None, None),
        ("FREE", "adult", "LEECHERS", "DESC"),
    ]
    assert [item["id"] for item in state.cached_data["torrents"]] == [
        "page-1",
        "page-2",
        "demand-1",
        "adult-1",
    ]
    assert state.cached_data["error"] is None
    assert state.cached_data["coverage"] == "page1+leechers_desc"
    assert state.cached_data["membership_complete"] is False
    assert state.cached_data["free_refresh_backoff_until"] is None
    assert state.cached_data["free_refresh_shards"]["FREE/normal/default"] == {
        "total": 250,
        "pages_fetched": 1,
        "complete": False,
        "items": 2,
    }
    assert set(state.cached_data["free_refresh_shards"]) == {
        "FREE/normal/default",
        "FREE/normal/leechers_desc",
        "FREE/adult/default",
        "FREE/adult/leechers_desc",
    }
    assert state.cached_data["total"] == 4
    assert len(emergency_calls) == 1
    assert [item["id"] for item in emergency_calls[0][0]] == [
        "page-1",
        "page-2",
        "demand-1",
        "adult-1",
    ]
    assert emergency_calls[0][1:] == (False, False)

    cached_after_refresh = state.cached_data
    result = await torrent.fetch_all_free_torrents()

    assert result is cached_after_refresh
    assert state.cached_data is cached_after_refresh
    assert client.calls == [
        ("FREE", "normal", None, None),
        ("FREE", "normal", "LEECHERS", "DESC"),
        ("FREE", "adult", None, None),
        ("FREE", "adult", "LEECHERS", "DESC"),
    ]
    assert len(emergency_calls) == 1


@pytest.mark.asyncio
async def test_fresh_cache_reuse_does_not_bypass_active_error_backoff(monkeypatch):
    previous_torrents = [{"id": "existing", "name": "Existing"}]
    state.cached_data = {
        "torrents": previous_torrents,
        "categories": [{"id": 1, "name": "Movie"}],
        "last_update": datetime.now(BEIJING_TZ).strftime("%Y-%m-%d %H:%M:%S"),
        "error": "rate limited",
        "total": 1,
        "free_refresh_backoff_until": (
            datetime.now(BEIJING_TZ) + timedelta(seconds=60)
        ).isoformat(),
        "free_refresh_backoff_reason": "rate limited",
    }
    client = _RefreshClient(
        {
            ("FREE", "normal"): FreeTorrentSearchResult(
                items=[_raw_torrent("new-normal")],
                succeeded=True,
                complete=True,
                pages_fetched=1,
                total=1,
            ),
            ("FREE", "adult"): FreeTorrentSearchResult(
                items=[],
                succeeded=True,
                complete=True,
                pages_fetched=1,
                total=0,
            ),
        }
    )
    emergency_calls = []

    async def fake_check_emergency_alerts(
        torrents, *, expiry_only=False, current_free_membership_complete=True
    ):
        emergency_calls.append((torrents, expiry_only, current_free_membership_complete))

    monkeypatch.setattr(torrent, "mt_client", client)
    import app.core.alerts as alerts

    monkeypatch.setattr(alerts, "check_emergency_alerts", fake_check_emergency_alerts)

    result = await torrent.fetch_all_free_torrents()

    assert result is state.cached_data
    assert state.cached_data["error"] == "rate limited"
    assert client.calls == []
    assert emergency_calls == [(previous_torrents, True, True)]


@pytest.mark.asyncio
async def test_fresh_cache_with_error_refreshes_instead_of_reusing(monkeypatch):
    state.cached_data = {
        "torrents": [{"id": "existing", "name": "Existing"}],
        "categories": [{"id": 1, "name": "Movie"}],
        "last_update": datetime.now(BEIJING_TZ).strftime("%Y-%m-%d %H:%M:%S"),
        "error": "previous error",
        "total": 1,
        "free_refresh_backoff_until": None,
        "free_refresh_backoff_reason": None,
    }
    client = _RefreshClient(
        {
            ("FREE", "normal"): FreeTorrentSearchResult(
                items=[_raw_torrent("new-normal")],
                succeeded=True,
                complete=True,
                pages_fetched=1,
                total=1,
            ),
            ("FREE", "adult"): FreeTorrentSearchResult(
                items=[_raw_torrent("new-adult")],
                succeeded=True,
                complete=True,
                pages_fetched=1,
                total=1,
            ),
        }
    )
    emergency_calls = []

    async def fake_check_emergency_alerts(
        torrents, *, expiry_only=False, current_free_membership_complete=True
    ):
        emergency_calls.append((torrents, expiry_only, current_free_membership_complete))

    monkeypatch.setattr(torrent, "mt_client", client)
    import app.core.alerts as alerts

    monkeypatch.setattr(alerts, "check_emergency_alerts", fake_check_emergency_alerts)

    result = await torrent.fetch_all_free_torrents()

    assert result is state.cached_data
    assert state.cached_data["error"] is None
    assert client.calls == [
        ("FREE", "normal", None, None),
        ("FREE", "normal", "LEECHERS", "DESC"),
        ("FREE", "adult", None, None),
        ("FREE", "adult", "LEECHERS", "DESC"),
    ]
    assert [item["id"] for item in state.cached_data["torrents"]] == [
        "new-normal",
        "new-adult",
    ]
    assert len(emergency_calls) == 1


class _Response:
    def __init__(self, payload, status_code=200):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


class _HTTPClient:
    def __init__(self, payloads):
        self.payloads = list(payloads)
        self.requests = []

    async def post(self, _url, **kwargs):
        self.requests.append(kwargs["json"])
        return _Response(self.payloads.pop(0))


@pytest.mark.asyncio
async def test_user_torrent_status_skips_malformed_mteam_items(monkeypatch):
    http_client = _HTTPClient(
        [
            {
                "code": "0",
                "data": {
                    "data": [
                        None,
                        {"torrent": {"id": "seed-1"}, "name": "seeding 1"},
                        {"id": "seed-2", "name": "seeding 2"},
                        {"torrent": None, "id": "seed-3", "name": "seeding 3"},
                        "bad item",
                    ]
                },
            },
            {
                "code": "0",
                "data": {
                    "data": [
                        {"torrent": {"id": "leech-1"}, "name": "leeching 1"},
                        None,
                        {"torrent": None, "id": "leech-2", "name": "leeching 2"},
                    ]
                },
            },
        ]
    )

    async def fake_http_client():
        return http_client

    monkeypatch.setattr(mteam_api, "MT_TOKEN", "token")
    monkeypatch.setattr(mteam_api, "MT_USER_ID", "233006")
    monkeypatch.setattr(mteam_api, "get_http_client", fake_http_client)

    client = MTClient(request_delay=0)
    result = await client.fetch_user_torrent_status()

    assert set(result["seeding"]) == {"seed-1", "seed-2", "seed-3"}
    assert set(result["leeching"]) == {"leech-1", "leech-2"}
    assert [request["type"] for request in http_client.requests] == ["SEEDING", "LEECHING"]


@pytest.mark.asyncio
async def test_empty_user_torrent_pages_clear_previous_status(monkeypatch):
    http_client = _HTTPClient(
        [
            {"code": "0"},
            {"code": "0", "data": None},
        ]
    )

    async def fake_http_client():
        return http_client

    async def no_sleep(_delay):
        return None

    monkeypatch.setattr(mteam_api, "MT_TOKEN", "token")
    monkeypatch.setattr(mteam_api, "MT_USER_ID", "233006")
    monkeypatch.setattr(mteam_api, "get_http_client", fake_http_client)
    monkeypatch.setattr(mteam_api.asyncio, "sleep", no_sleep)
    state.user_torrent_status = {
        "seeding": {"seed-old": {"id": "seed-old"}},
        "leeching": {"leech-old": {"id": "leech-old"}},
    }
    previous_hour = int(torrent.time.time()) // 3600 - 1
    state._last_user_status_refresh_hour = previous_hour

    status_result = await MTClient(request_delay=0).fetch_user_torrent_status_with_status()
    refresh_client = _RefreshClient(
        {
            ("FREE", "normal"): FreeTorrentSearchResult(
                items=[_raw_torrent("new-normal")],
                succeeded=True,
                complete=True,
                pages_fetched=1,
                total=1,
            ),
            ("FREE", "adult"): FreeTorrentSearchResult(
                items=[],
                succeeded=True,
                complete=True,
                pages_fetched=1,
                total=0,
            ),
        },
        user_status_result=status_result,
    )
    monkeypatch.setattr(torrent, "mt_client", refresh_client)
    import app.core.alerts as alerts

    async def fake_check_emergency_alerts(*_args, **_kwargs):
        return None

    monkeypatch.setattr(alerts, "check_emergency_alerts", fake_check_emergency_alerts)

    await torrent.fetch_all_free_torrents()

    assert status_result.succeeded is True
    assert state.user_torrent_status == {"seeding": {}, "leeching": {}}
    assert state._last_user_status_refresh_hour != previous_hour
    assert [request["type"] for request in http_client.requests] == ["SEEDING", "LEECHING"]

    http_client = _HTTPClient(
        [
            {"code": "0", "data": {}},
            {"code": "0", "data": {"data": None}},
        ]
    )
    inner_empty_result = await MTClient(request_delay=0).fetch_user_torrent_status_with_status()

    assert inner_empty_result.succeeded is True
    assert inner_empty_result.statuses == {"seeding": {}, "leeching": {}}
    assert [request["type"] for request in http_client.requests] == ["SEEDING", "LEECHING"]


@pytest.mark.asyncio
async def test_user_torrent_status_malformed_non_null_data_fails(monkeypatch):
    http_client = _HTTPClient(
        [
            {"code": "0", "data": {"data": {"id": "not-a-list"}}},
        ]
    )

    async def fake_http_client():
        return http_client

    async def no_sleep(_delay):
        return None

    monkeypatch.setattr(mteam_api, "MT_TOKEN", "token")
    monkeypatch.setattr(mteam_api, "MT_USER_ID", "233006")
    monkeypatch.setattr(mteam_api, "get_http_client", fake_http_client)
    monkeypatch.setattr(mteam_api.asyncio, "sleep", no_sleep)

    client = MTClient(request_delay=0)
    result = await client.fetch_user_torrent_status_with_status()

    assert result.succeeded is False
    assert result.statuses == {"seeding": {}, "leeching": {}}
    assert result.error == "获取做种中种子返回的 data 不是列表"
    assert [request["type"] for request in http_client.requests] == ["SEEDING"]

    http_client = _HTTPClient(
        [
            {"code": "0", "data": {"data": []}},
            {"code": "0", "data": {"data": "not-a-list"}},
        ]
    )
    result = await MTClient(request_delay=0).fetch_user_torrent_status_with_status()

    assert result.succeeded is False
    assert result.statuses == {"seeding": {}, "leeching": {}}
    assert result.error == "获取下载中种子返回的 data 不是列表"
    assert [request["type"] for request in http_client.requests] == ["SEEDING", "LEECHING"]


@pytest.mark.asyncio
async def test_user_torrent_status_preserves_no_user_and_request_failure(monkeypatch):
    async def unexpected_http_client():
        raise AssertionError("MT_USER_ID-less refresh must not hit M-Team")

    monkeypatch.setattr(mteam_api, "MT_TOKEN", "token")
    monkeypatch.setattr(mteam_api, "MT_USER_ID", "")
    monkeypatch.setattr(mteam_api, "get_http_client", unexpected_http_client)

    result = await MTClient(request_delay=0).fetch_user_torrent_status_with_status()

    assert result.succeeded is True
    assert result.statuses == {"seeding": {}, "leeching": {}}

    http_client = _HTTPClient(
        [
            {"code": "1", "message": "denied", "data": {"data": []}},
        ]
    )

    async def fake_http_client():
        return http_client

    monkeypatch.setattr(mteam_api, "MT_USER_ID", "233006")
    monkeypatch.setattr(mteam_api, "get_http_client", fake_http_client)

    result = await MTClient(request_delay=0).fetch_user_torrent_status_with_status()

    assert result.succeeded is False
    assert result.statuses == {"seeding": {}, "leeching": {}}
    assert result.error == "denied"
    assert [request["type"] for request in http_client.requests] == ["SEEDING"]


@pytest.mark.asyncio
async def test_background_refresh_survives_one_free_refresh_exception(monkeypatch):
    calls = []

    class StopLoop(Exception):
        pass

    async def failing_refresh():
        calls.append("refresh")
        raise RuntimeError("mteam status shape changed")

    async def stop_after_backoff(delay):
        calls.append(("sleep", delay))
        raise StopLoop()

    monkeypatch.setattr(torrent, "fetch_all_free_torrents", failing_refresh)
    monkeypatch.setattr(torrent.asyncio, "sleep", stop_after_backoff)

    with pytest.raises(StopLoop):
        await torrent.background_refresh_torrents()

    assert calls[0] == "refresh"
    assert calls[1][0] == "sleep"
    assert calls[1][1] == pytest.approx(torrent.REFRESH_INTERVAL, abs=1)
    assert state.cached_data["error"] == "mteam status shape changed"
    assert runtime_status.mteam.ok is False
    assert runtime_status.mteam.last_error == "mteam status shape changed"


@pytest.mark.asyncio
async def test_page_one_free_search_uses_mteam_default_sort_and_never_fetches_page_two(monkeypatch):
    http_client = _HTTPClient(
        [
            {
                "code": "0",
                "data": {"data": [_raw_torrent("1")], "total": 250},
            },
        ]
    )

    async def fake_http_client():
        return http_client

    monkeypatch.setattr(mteam_api, "MT_TOKEN", "token")
    monkeypatch.setattr(mteam_api, "get_http_client", fake_http_client)

    client = MTClient(request_delay=0)
    result = await client.search_free_torrents_page_one_with_status()

    assert result.succeeded is True
    assert result.complete is False
    assert result.pages_fetched == 1
    assert result.total == 250
    assert [item["id"] for item in result.items] == ["1"]
    assert http_client.requests == [
        {
            "mode": "normal",
            "discount": "FREE",
            "pageNumber": 1,
            "pageSize": 200,
        }
    ]


@pytest.mark.asyncio
async def test_status_search_fetches_all_pages_when_total_requires_more(monkeypatch):
    http_client = _HTTPClient(
        [
            {
                "code": "0",
                "data": {"data": [_raw_torrent("1"), _raw_torrent("2")], "total": 3},
            },
            {
                "code": "0",
                "data": {"data": [_raw_torrent("3")], "total": 3},
            },
        ]
    )

    async def fake_http_client():
        return http_client

    monkeypatch.setattr(mteam_api, "MT_TOKEN", "token")
    monkeypatch.setattr(mteam_api, "get_http_client", fake_http_client)

    client = MTClient(request_delay=0)
    result = await client.search_free_torrents_with_status(page_size=2)

    assert result.succeeded is True
    assert result.complete is True
    assert result.pages_fetched == 2
    assert [item["id"] for item in result.items] == ["1", "2", "3"]
    assert [request["pageNumber"] for request in http_client.requests] == [1, 2]
