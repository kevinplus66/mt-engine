from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

import app.config as config
import app.state as state

config.DEBUG = True

from app.main import app
from app.services.panel_collector import collector_status
from app.services.runtime_status import runtime_status


client = TestClient(app)


def test_health_check_keeps_existing_contract():
    state.cached_data["total"] = 7

    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["torrents_count"] == 7
    assert "timestamp" in body
    assert datetime.fromisoformat(body["timestamp"]).tzinfo == config.BEIJING_TZ


def test_root_redirects_to_panel_in_backend_static_mode():
    response = client.get("/", follow_redirects=False)

    assert response.status_code == 307
    assert response.headers["location"] == "/panel"


def test_status_reports_runtime_cache_dependencies_and_config():
    last_update = datetime.now().isoformat()
    panel_heartbeat = datetime.now(config.BEIJING_TZ).isoformat()
    backoff_until = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    backoff_reason = "M-Team rate limited page-one refresh"
    runtime_status.reset()
    runtime_status.mark_success("qbittorrent")
    state.cached_data.update(
        {
            "last_update": last_update,
            "total": 11,
            "error": None,
            "coverage": "page1",
            "membership_complete": False,
            "free_refresh_backoff_until": backoff_until,
            "free_refresh_backoff_reason": backoff_reason,
        }
    )
    collector_status.update(
        {
            "last_started": panel_heartbeat,
            "last_success": panel_heartbeat,
            "last_error": None,
            "last_duration_seconds": 0.1,
        }
    )
    response = client.get("/api/status")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["version"]
    assert body["commit"]
    assert datetime.fromisoformat(body["timestamp"]).tzinfo == config.BEIJING_TZ
    assert body["cache"]["last_update"] == last_update
    assert body["cache"]["last_success"] == last_update
    assert body["cache"]["total"] == 11
    assert body["cache"]["error"] is None
    assert body["cache"]["last_error"] is None
    assert body["cache"]["coverage"] == "page1"
    assert body["cache"]["membership_complete"] is False
    assert body["cache"]["free_refresh_backoff_until"] == backoff_until
    assert body["cache"]["free_refresh_backoff_reason"] == backoff_reason
    assert body["cache"]["next_refresh"]
    assert body["cache"]["age_seconds"] >= 0
    assert body["cache"]["stale"] is False
    assert body["panel_collector"]["stale_after_seconds"] >= 180
    assert body["panel_collector"]["last_started"] == panel_heartbeat
    assert body["panel_collector"]["last_success"] == panel_heartbeat
    assert body["panel_collector"]["next_refresh"].endswith("+08:00")
    assert body["dependencies"]["qbittorrent"]["name"] == "qbittorrent"
    assert body["dependencies"]["qbittorrent"]["ok"] is True
    assert datetime.fromisoformat(
        body["dependencies"]["qbittorrent"]["last_success"]
    ).tzinfo == config.BEIJING_TZ
    assert body["dependencies"]["mteam"]["ok"] is False
    assert body["dependencies"]["mteam"]["last_success"] is None
    assert body["dependencies"]["mteam"]["last_error"] is None
    assert body["config"]["refresh_interval_seconds"] >= 300
    assert body["config"]["panel_collect_interval_seconds"] >= 30
    assert "debug" in body["config"]
    assert "warnings" in body
    assert "free_refresh_backoff" in body["warnings"]


def test_status_warns_when_cache_is_stale():
    state.cached_data.update(
        {
            "last_update": (datetime.now() - timedelta(days=2)).isoformat(),
            "total": 11,
            "error": None,
        }
    )

    response = client.get("/api/status")

    assert response.status_code == 200
    body = response.json()
    assert body["cache"]["stale"] is True
    assert "free_cache_stale" in body["warnings"]


def test_status_accepts_utc_z_cache_timestamp():
    last_update = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    state.cached_data.update(
        {
            "last_update": last_update,
            "total": 3,
            "error": None,
        }
    )

    response = client.get("/api/status")

    assert response.status_code == 200
    body = response.json()
    assert body["cache"]["last_update"] == last_update
    assert body["cache"]["age_seconds"] >= 0


def test_status_treats_free_cache_timestamp_as_beijing_time():
    last_update = datetime.now(config.BEIJING_TZ).strftime("%Y-%m-%d %H:%M:%S")
    state.cached_data.update(
        {
            "last_update": last_update,
            "total": 3,
            "error": None,
        }
    )

    response = client.get("/api/status")

    assert response.status_code == 200
    body = response.json()
    assert body["cache"]["last_update"] == last_update
    assert 0 <= body["cache"]["age_seconds"] < 60
    assert body["cache"]["stale"] is False
    assert body["cache"]["next_refresh"].endswith("+08:00")
