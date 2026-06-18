from datetime import datetime

import pytest

import app.state as state
from app.config import BEIJING_TZ
from app.core import pilot as pilot_core
from app.models import AutomationConfig


def _free_torrent(torrent_id: str) -> dict:
    return {
        "id": torrent_id,
        "name": torrent_id,
        "discount": "FREE",
        "remaining": {"hours": 12},
        "seeders": 1,
        "leechers": 100,
        "size": 1024,
    }


@pytest.mark.asyncio
async def test_run_download_cycle_selects_highest_score_when_slots_are_limited(monkeypatch):
    torrents = [
        _free_torrent("lower-score"),
        _free_torrent("highest-score"),
        _free_torrent("middle-score"),
    ]
    scores = {
        "lower-score": 1.0,
        "highest-score": 10.0,
        "middle-score": 5.0,
    }
    selected_ids = []
    selected_scores = []

    manager = pilot_core.PilotManager()
    manager.config = AutomationConfig()
    manager.config.download.max_active_tasks = 1
    manager.config.download.disk_usage_threshold = 95

    def evaluate_download(torrent, **_kwargs):
        score = scores[torrent["id"]]
        return True, score, f"score {score}"

    async def fake_download_torrent(torrent, sid, score):
        assert sid == "sid"
        selected_ids.append(torrent["id"])
        selected_scores.append(score)
        return True

    monkeypatch.setitem(state.cached_data, "torrents", torrents)
    monkeypatch.setitem(
        state.cached_data,
        "last_update",
        datetime.now(BEIJING_TZ).strftime("%Y-%m-%d %H:%M:%S"),
    )
    monkeypatch.setitem(state.cached_data, "error", None)
    monkeypatch.setattr(pilot_core, "qb_login", lambda: _async_value("sid"))
    monkeypatch.setattr(
        pilot_core,
        "qb_get_existing_mteam_ids",
        lambda _sid: _async_value(set()),
    )
    monkeypatch.setattr(
        pilot_core,
        "qb_get_torrents",
        lambda _sid: _async_value([]),
    )
    monkeypatch.setattr(manager.rule_engine, "evaluate_download", evaluate_download)
    monkeypatch.setattr(manager, "_download_torrent", fake_download_torrent)

    await manager.run_download_cycle(force=True)

    assert selected_ids == ["highest-score"]
    assert selected_scores == [scores["highest-score"]]
    assert "lower-score" not in selected_ids
    assert "middle-score" not in selected_ids
    assert manager.pending_downloads == set()


async def _async_value(value):
    return value
