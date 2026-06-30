import time
from typing import Optional

import pytest

from app.core import pilot as pilot_core
from app.core import pilot_disk
from app.core import rules as pilot_rules
from app.models import AutomationConfig
from app.routes import pilot as pilot_routes

def _task(
    hash_: str,
    *,
    tags: str = "PILOT",
    progress: float = 1.0,
    seeding_time: int = 7200,
    ratio: float = 2.0,
    seeders: int = 10,
    leechers: int = 10,
    added_on: Optional[float] = None,
    speed: float = 500.0,
    score: float = 1.0,
    save_path: str = "/downloads/mt_free_farm",
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
        "speed": speed,
        "score": score,
        "uploaded": 0,
        "size": 100 * 1024**3,
        "dlspeed": 0,
        "state": "downloading" if progress < 1.0 else "uploading",
        "save_path": save_path,
    }


def _manager() -> pilot_core.PilotManager:
    manager = pilot_core.PilotManager()
    manager.config = AutomationConfig()
    manager.rule_engine = pilot_rules.RuleEngine(manager.config)
    manager.cleanup_tracker.cleanup_upload_history = lambda active_hashes: None
    manager.cleanup_tracker.get_sliding_window_speed = (
        lambda task, window_minutes=30, *, record=True: float(task["speed"])
    )
    manager.cleanup_tracker.calculate_cleanup_score = (
        lambda task, avg_speed_kbps: task["score"]
    )
    return manager


@pytest.mark.asyncio
async def test_notpilot_tag_does_not_count_or_delete(monkeypatch):
    task = _task(
        "notpilot",
        tags="NOTPILOT",
        ratio=3.0,
        seeders=0,
        leechers=0,
    )
    deleted = []

    async def fake_delete(torrent_hash, sid, delete_files=False):
        deleted.append((torrent_hash, sid, delete_files))
        return True

    assert not pilot_core.has_pilot_tag("NOTPILOT")
    assert pilot_core.has_pilot_tag("RADAR, PILOT")

    manager = _manager()
    manager.config.cleanup.min_seed_time_hours = 0
    manager.config.cleanup.min_current_users = 1
    manager.config.cleanup.elimination_ratio = 0
    manager.rule_engine = pilot_rules.RuleEngine(manager.config)

    monkeypatch.setattr(pilot_core, "qb_login", lambda: _async_value("sid"))
    monkeypatch.setattr(pilot_core, "qb_get_torrents", lambda _sid: _async_value([task]))
    monkeypatch.setattr(pilot_core, "qb_delete_torrent", fake_delete)

    await manager.run_cleanup_cycle(force=True)

    monkeypatch.setattr(pilot_routes, "qb_login", lambda: _async_value("sid"))
    monkeypatch.setattr(pilot_routes, "qb_get_torrents", lambda _sid: _async_value([task]))
    monkeypatch.setattr(
        pilot_routes.pilot_manager,
        "get_download_projection",
        lambda _tasks: {
            "disk_usage_percent": 0,
            "current_disk_usage_percent": 0,
            "projected_disk_usage_percent": 0,
            "active_download_remaining_bytes": 0,
            "download_budget_bytes": 0,
            "disk_usage_threshold_percent": pilot_routes.pilot_manager.config.download.disk_usage_threshold,
        },
    )

    stats = await pilot_routes.get_stats()

    assert stats["active_tasks"] == 0
    assert deleted == []




def test_near_expiry_free_torrent_is_not_download_candidate():
    config = AutomationConfig()
    config.download.rules.min_size_gb = 1
    config.download.rules.max_seeders = 0
    config.download.rules.min_leechers = 0
    engine = pilot_rules.RuleEngine(config)
    torrent = {
        "id": "near-expiry",
        "name": "Near Expiry",
        "size": 10 * 1024**3,
        "discount": "FREE",
        "remaining": {"hours": (pilot_rules.ALERT_THRESHOLD_MINUTES - 1) / 60},
        "seeders": 1,
        "leechers": 100,
    }

    should_download, _score, reason = engine.evaluate_download(torrent)

    assert should_download is False
    assert "FREE ends" in reason


def test_permanent_free_torrent_without_end_time_can_still_be_candidate():
    config = AutomationConfig()
    config.download.rules.min_size_gb = 1
    config.download.rules.max_seeders = 0
    config.download.rules.min_leechers = 0
    engine = pilot_rules.RuleEngine(config)
    torrent = {
        "id": "permanent-free",
        "name": "Permanent Free",
        "size": 10 * 1024**3,
        "discount": "FREE",
        "discount_end_time": None,
        "seeders": 1,
        "leechers": 100,
    }

    should_download, _score, reason = engine.evaluate_download(torrent)

    assert should_download is True
    assert reason.startswith("Score:")


def test_low_user_below_ratio_target_is_protected():
    config = AutomationConfig()
    config.cleanup.min_seed_time_hours = 0
    config.cleanup.min_share_ratio = 2.0
    config.cleanup.min_current_users = 10
    engine = pilot_rules.RuleEngine(config)

    should_delete, reason = engine.evaluate_cleanup(
        _task("low-ratio-low-users", ratio=1.0, seeders=0, leechers=0),
    )

    assert should_delete is False
    assert reason.startswith("Protected: ratio")



def test_active_download_past_max_time_is_not_zombie_deleted():
    config = AutomationConfig()
    config.cleanup.max_download_time_hours = 12
    engine = pilot_rules.RuleEngine(config)
    task = _task(
        "active-download",
        progress=0.5,
        added_on=time.time() - 13 * 3600,
    )
    task["dlspeed"] = 1024

    should_delete, reason = engine.evaluate_cleanup(task)

    assert should_delete is False
    assert reason.startswith("Downloading active")


def test_stalled_download_past_max_time_is_zombie_deleted():
    config = AutomationConfig()
    config.cleanup.max_download_time_hours = 12
    engine = pilot_rules.RuleEngine(config)
    task = _task(
        "stalled-download",
        progress=0.5,
        added_on=time.time() - 13 * 3600,
    )

    should_delete, reason = engine.evaluate_cleanup(task)

    assert should_delete is True
    assert reason.startswith("Zombie download")


def test_dead_seed_download_uses_dead_seed_minutes_before_zombie_timeout():
    config = AutomationConfig()
    config.cleanup.dead_seed_minutes = 30
    config.cleanup.max_download_time_hours = 12
    engine = pilot_rules.RuleEngine(config)
    task = _task(
        "dead-download",
        progress=0.1,
        seeders=0,
        leechers=0,
        added_on=time.time() - 31 * 60,
        ratio=0.0,
    )

    should_delete, reason = engine.evaluate_cleanup(task)

    assert should_delete is True
    assert reason.startswith("Dead download")


def test_negative_swarm_counts_are_unknown_not_low_users():
    config = AutomationConfig()
    config.cleanup.min_seed_time_hours = 0
    config.cleanup.min_current_users = 5
    engine = pilot_rules.RuleEngine(config)
    task = _task("unknown-swarm", progress=1.0, seeders=-1, leechers=-1)

    should_delete, reason = engine.evaluate_cleanup(task)

    assert should_delete is False
    assert reason == "Eligible for Phase 2"


def test_large_free_torrent_requires_size_scaled_runway():
    config = AutomationConfig()
    config.download.rules.min_size_gb = 1
    config.download.rules.max_seeders = 0
    config.download.rules.min_leechers = 1
    engine = pilot_rules.RuleEngine(config)
    torrent = {
        "id": "large-short-free",
        "name": "Large Short Free",
        "size": 240 * 1024**3,
        "discount": "FREE",
        "remaining": {"hours": 1.0},
        "seeders": 1,
        "leechers": 100,
    }

    should_download, _score, reason = engine.evaluate_download(torrent)

    assert should_download is False
    assert "FREE runway" in reason


@pytest.mark.asyncio
async def test_download_cycle_rejects_high_seeder_candidate(monkeypatch):
    manager = _manager()
    manager.config.download.max_active_tasks = 2
    manager.config.download.rules.min_size_gb = 1
    manager.config.download.rules.min_leechers = 70
    manager.config.download.rules.max_seeders = 10
    manager.rule_engine = pilot_rules.RuleEngine(manager.config)
    monkeypatch.setattr(
        manager, "_get_download_capacity_budget_bytes", lambda _tasks: 1024**4
    )
    torrent = {
        "id": "high-seeder-demand-gap",
        "name": "High Seeder Demand Gap",
        "size": 20 * 1024**3,
        "discount": "FREE",
        "discount_end_time": None,
        "remaining": {"hours": 24},
        "seeders": 40,
        "leechers": 120,
    }
    monkeypatch.setattr(
        pilot_core.state,
        "cached_data",
        {"torrents": [torrent], "error": None, "last_update": "fresh"},
    )
    monkeypatch.setattr(pilot_core, "check_disk_space", lambda _config: True)
    monkeypatch.setattr(
        pilot_core,
        "ensure_download_cache_fresh",
        lambda _config: _async_value(True),
    )
    monkeypatch.setattr(pilot_core, "qb_login", lambda: _async_value("sid"))
    monkeypatch.setattr(manager, "_get_existing_mteam_ids", lambda _sid: _async_value(set()))
    monkeypatch.setattr(pilot_core, "qb_get_torrents", lambda _sid: _async_value([]))
    downloaded = []

    async def fake_download(torrent_arg, sid, score):
        downloaded.append((torrent_arg["id"], sid, score))
        return True

    monkeypatch.setattr(manager, "_download_torrent", fake_download)

    await manager.run_download_cycle(force=True)

    assert downloaded == []


@pytest.mark.asyncio
async def test_download_cycle_rejects_low_leecher_candidate(monkeypatch):
    manager = _manager()
    manager.config.download.max_active_tasks = 2
    manager.config.download.rules.min_size_gb = 1
    manager.config.download.rules.min_leechers = 70
    manager.config.download.rules.max_seeders = 10
    manager.rule_engine = pilot_rules.RuleEngine(manager.config)
    monkeypatch.setattr(
        manager, "_get_download_capacity_budget_bytes", lambda _tasks: 1024**4
    )
    torrent = {
        "id": "medium-demand-low-seeder",
        "name": "Medium Demand Low Seeder",
        "size": 20 * 1024**3,
        "discount": "FREE",
        "discount_end_time": None,
        "remaining": {"hours": 24},
        "seeders": 8,
        "leechers": 55,
    }
    monkeypatch.setattr(
        pilot_core.state,
        "cached_data",
        {"torrents": [torrent], "error": None, "last_update": "fresh"},
    )
    monkeypatch.setattr(pilot_core, "check_disk_space", lambda _config: True)
    monkeypatch.setattr(
        pilot_core,
        "ensure_download_cache_fresh",
        lambda _config: _async_value(True),
    )
    monkeypatch.setattr(pilot_core, "qb_login", lambda: _async_value("sid"))
    monkeypatch.setattr(manager, "_get_existing_mteam_ids", lambda _sid: _async_value(set()))
    monkeypatch.setattr(pilot_core, "qb_get_torrents", lambda _sid: _async_value([]))
    downloaded = []

    async def fake_download(torrent_arg, sid, score):
        downloaded.append((torrent_arg["id"], sid, score))
        return True

    monkeypatch.setattr(manager, "_download_torrent", fake_download)

    await manager.run_download_cycle(force=True)

    assert downloaded == []


@pytest.mark.asyncio
async def test_download_cycle_rejects_saturated_high_seeder_candidate(monkeypatch):
    manager = _manager()
    manager.config.download.max_active_tasks = 2
    manager.config.download.rules.min_size_gb = 1
    manager.config.download.rules.min_leechers = 70
    manager.config.download.rules.max_seeders = 10
    manager.rule_engine = pilot_rules.RuleEngine(manager.config)
    monkeypatch.setattr(
        manager, "_get_download_capacity_budget_bytes", lambda _tasks: 1024**4
    )
    torrent = {
        "id": "saturated-popular",
        "name": "Saturated Popular",
        "size": 20 * 1024**3,
        "discount": "FREE",
        "discount_end_time": None,
        "remaining": {"hours": 24},
        "seeders": 80,
        "leechers": 90,
    }
    monkeypatch.setattr(
        pilot_core.state,
        "cached_data",
        {"torrents": [torrent], "error": None, "last_update": "fresh"},
    )
    monkeypatch.setattr(pilot_core, "check_disk_space", lambda _config: True)
    monkeypatch.setattr(
        pilot_core,
        "ensure_download_cache_fresh",
        lambda _config: _async_value(True),
    )
    monkeypatch.setattr(pilot_core, "qb_login", lambda: _async_value("sid"))
    monkeypatch.setattr(manager, "_get_existing_mteam_ids", lambda _sid: _async_value(set()))
    monkeypatch.setattr(pilot_core, "qb_get_torrents", lambda _sid: _async_value([]))
    downloaded = []

    async def fake_download(torrent_arg, sid, score):
        downloaded.append((torrent_arg["id"], sid, score))
        return True

    monkeypatch.setattr(manager, "_download_torrent", fake_download)

    await manager.run_download_cycle(force=True)

    assert downloaded == []



@pytest.mark.asyncio
async def test_download_cycle_does_not_add_torrent_beyond_disk_budget(monkeypatch):
    manager = _manager()
    manager.config.download.max_active_tasks = 2
    manager.config.download.rules.min_size_gb = 1
    manager.config.download.rules.min_leechers = 1
    manager.config.download.rules.max_seeders = 10
    manager.rule_engine = pilot_rules.RuleEngine(manager.config)
    torrent = {
        "id": "too-large",
        "name": "Too Large",
        "size": 20 * 1024**3,
        "discount": "FREE",
        "discount_end_time": None,
        "remaining": {"hours": 24},
        "seeders": 1,
        "leechers": 20,
    }
    monkeypatch.setattr(
        pilot_core.state,
        "cached_data",
        {"torrents": [torrent], "error": None, "last_update": "fresh"},
    )
    monkeypatch.setattr(pilot_core, "check_disk_space", lambda _config: True)
    monkeypatch.setattr(
        pilot_core,
        "ensure_download_cache_fresh",
        lambda _config: _async_value(True),
    )
    monkeypatch.setattr(pilot_core, "qb_login", lambda: _async_value("sid"))
    monkeypatch.setattr(manager, "_get_existing_mteam_ids", lambda _sid: _async_value(set()))
    monkeypatch.setattr(pilot_core, "qb_get_torrents", lambda _sid: _async_value([]))
    monkeypatch.setattr(manager, "_get_download_capacity_budget_bytes", lambda _tasks: 10 * 1024**3)
    downloaded = []

    async def fake_download(torrent_arg, sid, score):
        downloaded.append((torrent_arg["id"], sid, score))
        return True

    monkeypatch.setattr(manager, "_download_torrent", fake_download)

    await manager.run_download_cycle(force=True)

    assert downloaded == []


@pytest.mark.asyncio
async def test_missing_pilot_download_path_fails_closed_without_adding(monkeypatch):
    manager = _manager()
    downloaded = []

    def fake_exists(path):
        if path == "/downloads/mt_free_farm":
            return False
        return True

    async def fail_if_called():
        raise AssertionError("qB login must not run when disk path is missing")

    async def fake_download(*args):
        downloaded.append(args)
        return True


    monkeypatch.setattr(pilot_disk.os.path, "exists", fake_exists)
    monkeypatch.setattr(manager, "_download_torrent", fake_download)
    monkeypatch.setattr(pilot_core, "qb_login", fail_if_called)

    assert pilot_disk.check_disk_space(manager.config) is False

    await manager.run_download_cycle(force=True)
    assert downloaded == []


@pytest.mark.asyncio
async def test_dry_run_reports_missing_download_budget_path(monkeypatch):
    original_config = pilot_routes.pilot_manager.config
    original_rule_engine = pilot_routes.pilot_manager.rule_engine
    config = AutomationConfig()
    config.download.rules.min_size_gb = 1
    config.download.rules.max_seeders = 0
    config.download.rules.min_leechers = 0
    pilot_routes.pilot_manager.config = config
    pilot_routes.pilot_manager.rule_engine = pilot_rules.RuleEngine(config)
    torrent = {
        "id": "candidate",
        "name": "Candidate",
        "size": 20 * 1024**3,
        "discount": "FREE",
        "discount_end_time": None,
        "remaining": {"hours": 24},
        "seeders": 1,
        "leechers": 20,
    }

    def raise_missing_path(_tasks):
        raise pilot_disk.DownloadDiskError(
            "Download save path does not exist: /downloads/mt_free_farm"
        )

    try:
        monkeypatch.setattr(
            pilot_routes.state,
            "cached_data",
            {"torrents": [torrent], "error": None, "last_update": "fresh"},
        )
        monkeypatch.setattr(pilot_routes, "qb_login", lambda: _async_value("sid"))
        monkeypatch.setattr(
            pilot_routes,
            "qb_get_existing_mteam_ids",
            lambda _sid: _async_value(set()),
        )
        monkeypatch.setattr(pilot_routes, "qb_get_torrents", lambda _sid: _async_value([]))
        monkeypatch.setattr(
            pilot_routes.pilot_manager,
            "get_download_projection",
            raise_missing_path,
        )

        result = await pilot_routes.dry_run()

        assert result["download_candidates"] == []
        assert result["total_download_candidates"] == 0
        assert result["download_budget_bytes"] == 0
        assert result["current_disk_usage_percent"] is None
        assert result["projected_disk_usage_percent"] is None
        assert result["download_budget_error"] == (
            "Download save path does not exist: /downloads/mt_free_farm"
        )
    finally:
        pilot_routes.pilot_manager.config = original_config
        pilot_routes.pilot_manager.rule_engine = original_rule_engine



@pytest.mark.asyncio
async def test_dry_run_reports_projected_download_usage(monkeypatch):
    monkeypatch.setattr(
        pilot_routes.state,
        "cached_data",
        {"torrents": [], "error": None, "last_update": "fresh"},
    )
    monkeypatch.setattr(pilot_routes, "qb_login", lambda: _async_value("sid"))
    monkeypatch.setattr(
        pilot_routes,
        "qb_get_existing_mteam_ids",
        lambda _sid: _async_value(set()),
    )
    task = _task(
        "non-pilot-active",
        tags="RADAR",
        progress=0.25,
        ratio=0,
    )
    task["size"] = 400
    task["downloaded"] = 100

    class Usage:
        total = 1000
        used = 100

    monkeypatch.setattr(
        pilot_routes,
        "qb_get_torrents",
        lambda _sid: _async_value([task]),
    )
    monkeypatch.setattr(
        pilot_routes.pilot_manager.config.download,
        "disk_usage_threshold",
        90,
    )
    monkeypatch.setattr(
        pilot_core,
        "get_download_disk_usage",
        lambda _config: ("/downloads/mt_free_farm", Usage()),
    )
    monkeypatch.setattr(
        pilot_core,
        "_task_is_on_downloads_filesystem",
        lambda _task, _path: True,
    )

    result = await pilot_routes.dry_run()

    assert result["download_budget_bytes"] == 500
    assert result["current_disk_usage_percent"] == 10
    assert result["disk_usage_percent"] == 10
    assert result["projected_disk_usage_percent"] == 40
    assert result["active_download_remaining_bytes"] == 300
    assert result["disk_usage_threshold_percent"] == 90
    assert result["download_budget_error"] is None


def test_non_pilot_incomplete_download_reduces_download_budget(monkeypatch):
    manager = _manager()
    manager.config.download.disk_usage_threshold = 90
    task = _task(
        "non-pilot-active",
        tags="RADAR",
        progress=0.25,
        ratio=0,
    )
    task["size"] = 400
    task["downloaded"] = 100

    class Usage:
        total = 1000
        used = 100

    monkeypatch.setattr(
        pilot_core,
        "get_download_disk_usage",
        lambda _config: ("/downloads/mt_free_farm", Usage()),
    )
    monkeypatch.setattr(
        pilot_core,
        "_task_is_on_downloads_filesystem",
        lambda _task, _path: True,
    )

    projection = manager.get_download_projection([task])

    assert projection["current_disk_usage_percent"] == 10
    assert projection["disk_usage_percent"] == 10
    assert projection["projected_disk_usage_percent"] == 40
    assert projection["active_download_remaining_bytes"] == 300
    assert projection["download_budget_bytes"] == 500
    assert projection["disk_usage_threshold_percent"] == 90
    assert manager._get_download_capacity_budget_bytes([task]) == 500


@pytest.mark.asyncio
async def test_stats_reports_current_and_projected_download_usage(monkeypatch):
    monkeypatch.setattr(pilot_routes, "qb_login", lambda: _async_value("sid"))
    task = _task(
        "non-pilot-active",
        tags="RADAR",
        progress=0.25,
        ratio=0,
    )
    task["size"] = 400
    task["downloaded"] = 100

    class Usage:
        total = 1000
        used = 100

    monkeypatch.setattr(
        pilot_routes,
        "qb_get_torrents",
        lambda _sid: _async_value([task]),
    )
    monkeypatch.setattr(
        pilot_routes.pilot_manager.config.download,
        "disk_usage_threshold",
        90,
    )
    monkeypatch.setattr(
        pilot_core,
        "get_download_disk_usage",
        lambda _config: ("/downloads/mt_free_farm", Usage()),
    )
    monkeypatch.setattr(
        pilot_core,
        "_task_is_on_downloads_filesystem",
        lambda _task, _path: True,
    )

    stats = await pilot_routes.get_stats()

    assert stats["disk_usage_percent"] == 10
    assert stats["current_disk_usage_percent"] == 10
    assert stats["projected_disk_usage_percent"] == 40
    assert stats["active_download_remaining_bytes"] == 300
    assert stats["download_budget_bytes"] == 500
    assert stats["disk_usage_threshold_percent"] == 90


@pytest.mark.asyncio
async def test_download_cycle_does_not_pause_existing_tasks_when_projected_over_budget(monkeypatch):
    manager = _manager()
    manager.config.download.max_active_tasks = 2
    torrent = {
        "id": "candidate",
        "name": "Candidate",
        "size": 20 * 1024**3,
        "discount": "FREE",
        "discount_end_time": None,
        "remaining": {"hours": 24},
        "seeders": 1,
        "leechers": 100,
    }
    monkeypatch.setattr(
        pilot_core.state,
        "cached_data",
        {"torrents": [torrent], "error": None, "last_update": "fresh"},
    )
    monkeypatch.setattr(pilot_core, "check_disk_space", lambda _config: True)
    monkeypatch.setattr(
        pilot_core,
        "ensure_download_cache_fresh",
        lambda _config: _async_value(True),
    )
    monkeypatch.setattr(pilot_core, "qb_login", lambda: _async_value("sid"))
    monkeypatch.setattr(manager, "_get_existing_mteam_ids", lambda _sid: _async_value(set()))
    tasks = [
        _task("big", progress=0.2),
        _task("small", progress=0.9),
    ]
    monkeypatch.setattr(pilot_core, "qb_get_torrents", lambda _sid: _async_value(tasks))
    monkeypatch.setattr(manager, "_get_download_capacity_budget_bytes", lambda _tasks: -1)
    downloaded = []

    async def fake_download(torrent_arg, sid, score):
        downloaded.append((torrent_arg["id"], sid, score))
        return True

    monkeypatch.setattr(manager, "_download_torrent", fake_download)

    await manager.run_download_cycle(force=True)

    assert downloaded == []

def test_score_prioritizes_leechers_over_seeders_gap():
    config = AutomationConfig()
    rules = config.download.rules
    rules.min_size_gb = 1
    low_supply = {
        "size": 20 * 1024**3,
        "discount": "FREE",
        "discount_end_time": None,
        "seeders": 5,
        "leechers": 80,
    }
    saturated = {
        **low_supply,
        "seeders": 80,
        "leechers": 80,
    }

    assert pilot_rules.calculate_score(low_supply, rules) > pilot_rules.calculate_score(
        saturated,
        rules,
    )


def test_score_prioritizes_high_demand_over_long_free_runway():
    config = AutomationConfig()
    rules = config.download.rules
    rules.min_size_gb = 1
    low_demand_long_free = {
        "size": 20 * 1024**3,
        "discount": "FREE",
        "remaining": {"hours": 168},
        "seeders": 5,
        "leechers": 40,
    }
    high_demand_short_free = {
        **low_demand_long_free,
        "remaining": {"hours": 24},
        "seeders": 5,
        "leechers": 200,
    }

    assert pilot_rules.calculate_score(high_demand_short_free, rules) > pilot_rules.calculate_score(
        low_demand_long_free,
        rules,
    )



def test_score_gives_bounded_bonus_to_2x_free_over_equivalent_free():
    config = AutomationConfig()
    rules = config.download.rules
    rules.min_size_gb = 1
    free = {
        "size": 20 * 1024**3,
        "discount": "FREE",
        "remaining": {"hours": 24},
        "seeders": 5,
        "leechers": 100,
    }
    two_x_free = {**free, "discount": "_2X_FREE"}

    free_score = pilot_rules.calculate_score(free, rules)
    two_x_free_score = pilot_rules.calculate_score(two_x_free, rules)

    assert "_2X_FREE" in rules.discount_types
    assert two_x_free_score > free_score
    assert two_x_free_score - free_score == pytest.approx(pilot_rules.TWO_X_FREE_SCORE_BONUS)


@pytest.mark.asyncio
async def test_elimination_ratio_uses_only_speed_scored_eligible_tasks(monkeypatch):
    eligible_low = _task("eligible-low", speed=500.0, score=0.1)
    eligible_high = _task("eligible-high", speed=500.0, score=0.9)
    protected = [
        _task(
            f"protected-{index}",
            progress=0.5,
            seeding_time=0,
            added_on=time.time(),
        )
        for index in range(8)
    ]
    deleted = []

    async def fake_delete(torrent_hash, sid, delete_files=False):
        deleted.append((torrent_hash, sid, delete_files))
        return True

    manager = _manager()
    manager.config.cleanup.min_seed_time_hours = 1
    manager.config.cleanup.max_download_time_hours = 12
    manager.config.cleanup.min_current_users = 0
    manager.config.cleanup.min_share_ratio = 0
    manager.config.cleanup.min_upload_speed_kbps = 200
    manager.config.cleanup.elimination_ratio = 50
    manager.rule_engine = pilot_rules.RuleEngine(manager.config)

    monkeypatch.setattr(pilot_core, "qb_login", lambda: _async_value("sid"))
    monkeypatch.setattr(
        pilot_core,
        "qb_get_torrents",
        lambda _sid: _async_value([eligible_low, eligible_high, *protected]),
    )
    monkeypatch.setattr(pilot_core, "qb_delete_torrent", fake_delete)

    await manager.run_cleanup_cycle(force=True)

    assert deleted == [("eligible-low", "sid", True)]


async def _async_value(value):
    return value
