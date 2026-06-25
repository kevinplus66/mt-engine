import pytest

from app import state
from app.routes import panel
from app.services import mteam_api, panel_collector



def _patch_cold_qb(monkeypatch, *, stats=None, storage=None):
    async def fake_get_latest_stats():
        return None

    async def fake_qb_login():
        return "sid"

    async def fake_qb_get_mteam_stats(sid):
        assert sid == "sid"
        return stats or {
            "uploaded": 10,
            "downloaded": 20,
            "upload_speed": 3,
            "download_speed": 4,
            "seeding_count": 5,
            "leeching_count": 6,
        }

    async def fake_qb_get_storage_info(sid):
        assert sid == "sid"
        return storage or {"total": 1000, "used": 400, "free": 600, "percent": 40.0}

    profile_fetch_calls = []

    async def fail_if_profile_fetched():
        profile_fetch_calls.append(True)
        raise AssertionError("cold panel stats must not fetch live M-Team profile")

    monkeypatch.setattr(panel, "get_latest_stats", fake_get_latest_stats)
    monkeypatch.setattr(panel, "qb_login", fake_qb_login)
    monkeypatch.setattr(panel, "qb_get_mteam_stats", fake_qb_get_mteam_stats)
    monkeypatch.setattr(panel, "qb_get_storage_info", fake_qb_get_storage_info)
    monkeypatch.setattr(mteam_api.mt_client, "fetch_user_profile", fail_if_profile_fetched)
    return profile_fetch_calls


@pytest.mark.asyncio
async def test_cold_panel_stats_uses_cached_user_profile_without_live_mteam_call(monkeypatch):
    profile_fetch_calls = _patch_cold_qb(monkeypatch)
    monkeypatch.setattr(
        state,
        "user_profile",
        {
            "share_ratio": 2.5,
            "uploaded": 123456,
            "downloaded": 65432,
            "uploaded_display": "120.56 KiB",
            "downloaded_display": "63.90 KiB",
        },
    )

    result = await panel.get_panel_stats()
    assert profile_fetch_calls == []

    assert result["mteam"] == {
        "uploaded": 123456,
        "downloaded": 65432,
        "uploaded_display": "120.56 KiB",
        "downloaded_display": "63.90 KiB",
    }
    assert result["user"] == {
        "share_ratio": 2.5,
        "uploaded": 123456,
        "downloaded": 65432,
        "uploaded_display": "120.56 KiB",
        "downloaded_display": "63.90 KiB",
        "seeding_count": 5,
        "leeching_count": 6,
    }
    assert result["qbittorrent"]["uploaded"] == 10
    assert result["qbittorrent"]["downloaded"] == 20
    assert result["storage"] == {"total": 1000, "used": 400, "free": 600, "percent": 40.0}


@pytest.mark.asyncio
async def test_cold_panel_stats_empty_default_profile_skips_live_mteam_call(monkeypatch):
    profile_fetch_calls = _patch_cold_qb(monkeypatch)
    monkeypatch.setattr(
        state,
        "user_profile",
        {
            "share_ratio": 0,
            "uploaded": 0,
            "downloaded": 0,
            "uploaded_display": "0 B",
            "downloaded_display": "0 B",
        },
    )

    result = await panel.get_panel_stats()
    assert profile_fetch_calls == []

    assert result["mteam"] == {}
    assert result["user"] == {}
    assert result["qbittorrent"]["uploaded"] == 10
    assert result["qbittorrent"]["downloaded"] == 20


@pytest.mark.asyncio
async def test_panel_collector_does_not_persist_default_zero_user_profile(monkeypatch):
    monkeypatch.setattr(
        state,
        "user_profile",
        {
            "share_ratio": 0,
            "uploaded": 0,
            "downloaded": 0,
            "uploaded_display": "0 B",
            "downloaded_display": "0 B",
        },
    )

    async def fake_qb_login():
        return "sid"

    async def fake_qb_get_mteam_stats(sid):
        assert sid == "sid"
        return {
            "uploaded": 10,
            "downloaded": 20,
            "upload_speed": 3,
            "download_speed": 4,
            "seeding_count": 5,
            "leeching_count": 6,
        }

    saved = []

    async def fake_save_panel_stats_batch(
        timestamp, qb_traffic=None, mteam_traffic=None, user_stats=None
    ):
        saved.append(
            {
                "timestamp": timestamp,
                "qb_traffic": qb_traffic,
                "mteam_traffic": mteam_traffic,
                "user_stats": user_stats,
            }
        )
        return True

    monkeypatch.setattr(panel_collector, "qb_login", fake_qb_login)
    monkeypatch.setattr(panel_collector, "qb_get_mteam_stats", fake_qb_get_mteam_stats)
    monkeypatch.setattr(panel_collector, "save_panel_stats_batch", fake_save_panel_stats_batch)

    await panel_collector.collect_panel_data()

    assert len(saved) == 1
    assert saved[0]["qb_traffic"]["uploaded"] == 10
    assert saved[0]["mteam_traffic"] is None
    assert saved[0]["user_stats"] is None


@pytest.mark.asyncio
async def test_panel_stats_uses_db_sample_timestamp_for_last_update(monkeypatch):
    async def fake_get_latest_stats():
        return {
            "mteam": {"uploaded": 100, "downloaded": 50},
            "qbittorrent": {
                "uploaded": 200,
                "downloaded": 80,
                "upload_speed": 3,
                "download_speed": 4,
            },
            "user": {
                "share_ratio": 2.0,
                "uploaded": 100,
                "downloaded": 50,
                "bonus": 7,
                "seeding_count": 8,
                "leeching_count": 1,
                "user_level": "power",
            },
            "last_update": 1234567890,
        }

    async def fake_qb_login():
        return None

    monkeypatch.setattr(panel, "get_latest_stats", fake_get_latest_stats)
    monkeypatch.setattr(panel, "qb_login", fake_qb_login)
    monkeypatch.setattr(
        panel,
        "calculate_30min_avg_speeds",
        lambda: {"upload": 0, "download": 0},
    )

    result = await panel.get_panel_stats()

    assert result["last_update"] == 1234567890