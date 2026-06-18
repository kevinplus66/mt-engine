import time
from typing import Optional

import pytest

from app.core import pilot as pilot_core
from app.core import rules as pilot_rules
from app.models import AutomationConfig


def _task(
    hash_: str,
    *,
    tags: str,
    progress: float = 1.0,
    seeding_time: int = 2 * 3600,
    ratio: float = 2.0,
    seeders: int = 0,
    leechers: int = 0,
    added_on: Optional[float] = None,
    dlspeed: int = 0,
    state: Optional[str] = None,
) -> dict:
    return {
        "hash": hash_,
        "name": hash_,
        "tags": tags,
        "progress": progress,
        "seeding_time": seeding_time,
        "ratio": ratio,
        "num_complete": seeders,
        "num_incomplete": leechers,
        "added_on": time.time() if added_on is None else added_on,
        "dlspeed": dlspeed,
        "state": state if state is not None else ("downloading" if progress < 1.0 else "uploading"),
    }


def _manager() -> pilot_core.PilotManager:
    manager = pilot_core.PilotManager()
    manager.config = AutomationConfig()
    manager.config.cleanup.min_seed_time_hours = 1
    manager.config.cleanup.min_share_ratio = 1.0
    manager.config.cleanup.min_current_users = 1
    manager.config.cleanup.min_upload_speed_kbps = 0
    manager.config.cleanup.elimination_ratio = 0
    manager.rule_engine = pilot_rules.RuleEngine(manager.config)
    return manager


@pytest.mark.asyncio
async def test_run_cleanup_cycle_auto_deletes_only_eligible_pilot_task(monkeypatch):
    eligible_pilot = _task("eligible-pilot", tags="RADAR, PILOT")
    non_pilot = _task("non-pilot", tags="RADAR")
    protected_pilot = _task("protected-pilot", tags="PILOT", ratio=0.5)
    deleted = []

    async def fake_login():
        return "sid"

    async def fake_get_torrents(sid):
        assert sid == "sid"
        return [eligible_pilot, non_pilot, protected_pilot]

    async def fake_delete_torrent(torrent_hash, sid, delete_files=False):
        assert delete_files is True
        deleted.append((torrent_hash, sid, delete_files))
        return True

    manager = _manager()
    should_delete_eligible, eligible_reason = manager.rule_engine.evaluate_cleanup(eligible_pilot)
    should_delete_non_pilot, non_pilot_reason = manager.rule_engine.evaluate_cleanup(non_pilot)
    should_delete_protected, protected_reason = manager.rule_engine.evaluate_cleanup(protected_pilot)
    assert should_delete_eligible is True
    assert should_delete_non_pilot is True
    assert should_delete_protected is False
    assert eligible_reason.startswith("Low users")
    assert non_pilot_reason.startswith("Low users")
    assert protected_reason.startswith("Protected")

    monkeypatch.setattr(pilot_core, "qb_login", fake_login)
    monkeypatch.setattr(pilot_core, "qb_get_torrents", fake_get_torrents)
    monkeypatch.setattr(pilot_core, "qb_delete_torrent", fake_delete_torrent)

    await manager.run_cleanup_cycle(force=True)

    assert deleted == [("eligible-pilot", "sid", True)]
    assert manager.total_cleanups == 1


@pytest.mark.asyncio
async def test_cleanup_cycle_deletes_all_overdue_pilot_downloads_in_one_run(monkeypatch):
    manager = _manager()
    manager.config.cleanup.max_download_time_hours = 1
    manager.rule_engine = pilot_rules.RuleEngine(manager.config)
    added_on = time.time() - (2 * 3600)
    overdue_one = _task(
        "overdue-one",
        tags="PILOT",
        progress=0.4,
        added_on=added_on,
        seeders=1,
    )
    overdue_two = _task(
        "overdue-two",
        tags="RADAR, PILOT",
        progress=0.7,
        added_on=added_on,
        seeders=1,
    )
    active_download = _task(
        "active-download",
        tags="PILOT",
        progress=0.3,
        added_on=added_on,
        dlspeed=4096,
        seeders=1,
    )
    non_pilot_overdue = _task(
        "non-pilot-overdue",
        tags="RADAR",
        progress=0.2,
        added_on=added_on,
        seeders=1,
    )
    deleted = []

    async def fake_login():
        return "sid"

    async def fake_get_torrents(sid):
        assert sid == "sid"
        return [overdue_one, active_download, non_pilot_overdue, overdue_two]

    async def fake_delete_torrent(torrent_hash, sid, delete_files=False):
        deleted.append((torrent_hash, sid, delete_files))
        return True

    monkeypatch.setattr(pilot_core, "qb_login", fake_login)
    monkeypatch.setattr(pilot_core, "qb_get_torrents", fake_get_torrents)
    monkeypatch.setattr(pilot_core, "qb_delete_torrent", fake_delete_torrent)

    await manager.run_cleanup_cycle(force=True)

    assert deleted == [
        ("overdue-one", "sid", True),
        ("overdue-two", "sid", True),
    ]
    assert manager.total_cleanups == 2


@pytest.mark.asyncio
async def test_cleanup_cycle_deletes_low_speed_mature_seed_without_waiting_for_elimination(monkeypatch):
    slow_seed = _task("slow-seed", tags="PILOT", seeders=8, leechers=8)
    fast_seed = _task("fast-seed", tags="PILOT", seeders=8, leechers=8)
    deleted = []
    history_cleanups = []

    manager = _manager()
    manager.config.cleanup.min_seed_time_hours = 1
    manager.config.cleanup.min_share_ratio = 0
    manager.config.cleanup.min_current_users = 0
    manager.config.cleanup.min_upload_speed_kbps = 200
    manager.config.cleanup.elimination_ratio = 0
    manager.rule_engine = pilot_rules.RuleEngine(manager.config)
    speeds = {"slow-seed": 50.0, "fast-seed": 500.0}

    async def fake_login():
        return "sid"

    async def fake_get_torrents(sid):
        assert sid == "sid"
        return [slow_seed, fast_seed]

    async def fake_delete_torrent(torrent_hash, sid, delete_files=False):
        deleted.append((torrent_hash, sid, delete_files))
        return True

    monkeypatch.setattr(pilot_core, "qb_login", fake_login)
    monkeypatch.setattr(pilot_core, "qb_get_torrents", fake_get_torrents)
    monkeypatch.setattr(pilot_core, "qb_delete_torrent", fake_delete_torrent)
    monkeypatch.setattr(
        manager.cleanup_tracker,
        "cleanup_upload_history",
        lambda active_hashes: history_cleanups.append(active_hashes),
    )
    monkeypatch.setattr(
        manager.cleanup_tracker,
        "get_sliding_window_speed",
        lambda task, window_minutes=30: speeds[task["hash"]],
    )
    monkeypatch.setattr(
        manager.cleanup_tracker,
        "calculate_cleanup_score",
        lambda task, avg_speed_kbps: avg_speed_kbps,
    )

    await manager.run_cleanup_cycle(force=True)

    assert history_cleanups == [{"slow-seed", "fast-seed"}]
    assert deleted == [("slow-seed", "sid", True)]
    assert manager.total_cleanups == 1
