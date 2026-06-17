from datetime import datetime, timedelta

import pytest

import app.state as state
from app.config import BEIJING_TZ
from app.core import alerts
import app.services.qbittorrent as qb_service


@pytest.fixture(autouse=True)
def reset_alert_state(monkeypatch):
    state.auto_delete_enabled = True
    state.known_free_torrent_ids.clear()
    state.sent_alerts.clear()
    state.user_torrent_status = {"seeding": {}, "leeching": {}}

    monkeypatch.setattr(alerts, "QBITTORRENT_URL", "http://qbittorrent")
    monkeypatch.setattr(alerts, "PUSHPLUS_TOKEN", "")
    monkeypatch.setattr(alerts, "can_send_alert", lambda *_args, **_kwargs: True)

    yield

    state.auto_delete_enabled = True
    state.known_free_torrent_ids.clear()
    state.sent_alerts.clear()
    state.user_torrent_status = {"seeding": {}, "leeching": {}}


def _free_torrent(torrent_id: str, minutes_remaining: int = 60) -> dict:
    end_time = datetime.now(BEIJING_TZ).replace(tzinfo=None) + timedelta(
        minutes=minutes_remaining
    )
    return {
        "id": torrent_id,
        "name": f"Torrent {torrent_id}",
        "discount": "FREE",
        "discount_end_time": end_time.strftime("%Y-%m-%d %H:%M:%S"),
    }


def _cached_leeching_torrent(torrent_id: str, minutes_remaining: int = 5) -> None:
    end_time = datetime.now(BEIJING_TZ).replace(tzinfo=None) + timedelta(
        minutes=minutes_remaining
    )
    state.user_torrent_status["leeching"][torrent_id] = {
        "peer": {"downloaded": 42},
        "torrent": {
            "name": f"Cached torrent {torrent_id}",
            "size": 100,
            "status": {
                "discount": "FREE",
                "discountEndTime": end_time.strftime("%Y-%m-%d %H:%M:%S"),
            },
        },
    }


def _downloading_task(torrent_hash: str = "hash-123") -> dict:
    return {
        "hash": torrent_hash,
        "name": "Pilot downloading task",
        "state": "downloading",
        "progress": 0.42,
        "tags": "PILOT",
    }


async def _sid():
    return "sid"


async def _trackers(*_args):
    return []


def _install_mteam_tracker_lookup(monkeypatch, torrents, hash_to_mteam_id):
    async def fake_get_torrents(_sid):
        return torrents

    async def fake_get_torrent_trackers(torrent_hash, _sid):
        mteam_id = hash_to_mteam_id.get(torrent_hash)
        return [{"mteam_id": mteam_id}] if mteam_id else []

    monkeypatch.setattr(qb_service, "qb_get_torrents", fake_get_torrents)
    monkeypatch.setattr(qb_service, "qb_get_torrent_trackers", fake_get_torrent_trackers)
    monkeypatch.setattr(
        qb_service,
        "extract_mteam_id_from_trackers",
        lambda trackers: trackers[0]["mteam_id"] if trackers else None,
    )


@pytest.mark.asyncio
async def test_auto_delete_does_not_delete_untagged_tracker_match(monkeypatch):
    deleted = []
    torrents = [{"hash": "hash-manual", "name": "Manual M-Team torrent", "tags": ""}]
    _install_mteam_tracker_lookup(monkeypatch, torrents, {"hash-manual": "123"})

    async def fake_delete(torrent_hash, sid, delete_files=False):
        deleted.append((torrent_hash, sid, delete_files))
        return True

    found_hash = await qb_service.qb_find_torrent_by_mteam_id("123", "sid")
    assert found_hash == "hash-manual"

    monkeypatch.setattr(alerts, "qb_delete_torrent", fake_delete)

    deleted_successfully, torrent_found, login_success, sid = (
        await alerts._try_auto_delete(
            "123",
            "免费即将到期",
            "sid",
        )
    )

    assert (deleted_successfully, torrent_found, login_success, sid) == (
        False,
        False,
        True,
        "sid",
    )
    assert deleted == []


@pytest.mark.asyncio
@pytest.mark.parametrize("managed_tag", ["声呐做种", "雷达下载", "PILOT"])
async def test_auto_delete_deletes_exact_managed_tracker_match(monkeypatch, managed_tag):
    deleted = []
    torrents = [
        {"hash": "hash-manual", "name": "Manual M-Team torrent", "tags": ""},
        {"hash": "hash-managed", "name": "Managed M-Team torrent", "tags": managed_tag},
    ]
    _install_mteam_tracker_lookup(
        monkeypatch,
        torrents,
        {"hash-manual": "123", "hash-managed": "123"},
    )

    async def fake_delete(torrent_hash, sid, delete_files=False):
        deleted.append((torrent_hash, sid, delete_files))
        return True

    monkeypatch.setattr(alerts, "qb_delete_torrent", fake_delete)

    deleted_successfully, torrent_found, login_success, sid = (
        await alerts._try_auto_delete(
            "123",
            "免费即将到期",
            "sid",
        )
    )

    assert (deleted_successfully, torrent_found, login_success, sid) == (
        True,
        True,
        True,
        "sid",
    )
    assert deleted == [("hash-managed", "sid", True)]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "tags", ["PILOTING", "manual-PILOT", "声呐做种中", "雷达下载中"]
)
async def test_auto_delete_rejects_substring_managed_tags(monkeypatch, tags):
    deleted = []
    torrents = [
        {"hash": "hash-substring", "name": "Substring tag torrent", "tags": tags}
    ]
    _install_mteam_tracker_lookup(monkeypatch, torrents, {"hash-substring": "123"})

    async def fake_delete(torrent_hash, sid, delete_files=False):
        deleted.append((torrent_hash, sid, delete_files))
        return True

    found_hash = await qb_service.qb_find_torrent_by_mteam_id("123", "sid")
    assert found_hash == "hash-substring"

    monkeypatch.setattr(alerts, "qb_delete_torrent", fake_delete)

    deleted_successfully, torrent_found, login_success, sid = (
        await alerts._try_auto_delete(
            "123",
            "免费即将到期",
            "sid",
        )
    )

    assert (deleted_successfully, torrent_found, login_success, sid) == (
        False,
        False,
        True,
        "sid",
    )
    assert deleted == []


@pytest.mark.asyncio
async def test_auto_delete_expiring_free_torrent_without_pushplus(monkeypatch):
    deleted = []

    async def fake_get_torrents(_sid):
        return [_downloading_task()]

    async def fake_delete(torrent_hash, sid, delete_files=False):
        deleted.append((torrent_hash, sid, delete_files))
        return True

    monkeypatch.setattr(alerts, "qb_login", _sid)
    monkeypatch.setattr(alerts, "qb_get_torrents", fake_get_torrents)
    monkeypatch.setattr(alerts, "qb_get_torrent_trackers", _trackers)
    monkeypatch.setattr(alerts, "extract_mteam_id_from_trackers", lambda _trackers: "123")
    monkeypatch.setattr(alerts, "qb_delete_torrent", fake_delete)

    await alerts.check_emergency_alerts([_free_torrent("123", minutes_remaining=5)])

    assert deleted == [("hash-123", "sid", True)]


@pytest.mark.asyncio
async def test_auto_delete_when_known_free_torrent_disappears(monkeypatch):
    state.known_free_torrent_ids.add("123")
    deleted = []

    async def fake_get_torrents(_sid):
        return [_downloading_task()]

    async def fake_delete(torrent_hash, sid, delete_files=False):
        deleted.append((torrent_hash, sid, delete_files))
        return True

    monkeypatch.setattr(alerts, "qb_login", _sid)
    monkeypatch.setattr(alerts, "qb_get_torrents", fake_get_torrents)
    monkeypatch.setattr(alerts, "qb_get_torrent_trackers", _trackers)
    monkeypatch.setattr(alerts, "extract_mteam_id_from_trackers", lambda _trackers: "123")
    monkeypatch.setattr(alerts, "qb_delete_torrent", fake_delete)

    await alerts.check_emergency_alerts([_free_torrent("999", minutes_remaining=60)])

    assert deleted == [("hash-123", "sid", True)]


@pytest.mark.asyncio
async def test_expiry_only_deletes_absent_cached_free_torrent(monkeypatch):
    _cached_leeching_torrent("123", minutes_remaining=5)
    deleted = []

    async def fake_get_torrents(_sid):
        return []

    async def fake_find(torrent_id, sid, managed_only=False):
        assert (torrent_id, sid, managed_only) == ("123", "sid", True)
        return "hash-cached"

    async def fake_delete(torrent_hash, sid, delete_files=False):
        deleted.append((torrent_hash, sid, delete_files))
        return True

    monkeypatch.setattr(alerts, "qb_login", _sid)
    monkeypatch.setattr(alerts, "qb_get_torrents", fake_get_torrents)
    monkeypatch.setattr(alerts, "qb_find_torrent_by_mteam_id", fake_find)
    monkeypatch.setattr(alerts, "qb_delete_torrent", fake_delete)

    await alerts.check_emergency_alerts([], expiry_only=True)

    assert deleted == [("hash-cached", "sid", True)]


@pytest.mark.asyncio
async def test_partial_membership_deletes_absent_cached_expiring_free_torrent(monkeypatch):
    _cached_leeching_torrent("123", minutes_remaining=5)
    deleted = []

    async def fake_get_torrents(_sid):
        return []

    async def fake_find(torrent_id, sid, managed_only=False):
        assert (torrent_id, sid, managed_only) == ("123", "sid", True)
        return "hash-cached"

    async def fake_delete(torrent_hash, sid, delete_files=False):
        deleted.append((torrent_hash, sid, delete_files))
        return True

    monkeypatch.setattr(alerts, "qb_login", _sid)
    monkeypatch.setattr(alerts, "qb_get_torrents", fake_get_torrents)
    monkeypatch.setattr(alerts, "qb_find_torrent_by_mteam_id", fake_find)
    monkeypatch.setattr(alerts, "qb_delete_torrent", fake_delete)

    await alerts.check_emergency_alerts(
        [_free_torrent("999", minutes_remaining=60)],
        current_free_membership_complete=False,
    )

    assert deleted == [("hash-cached", "sid", True)]


@pytest.mark.asyncio
async def test_partial_membership_does_not_delete_known_free_absent_from_page(monkeypatch):
    state.known_free_torrent_ids.add("123")
    deleted = []

    async def fake_get_torrents(_sid):
        return [_downloading_task()]

    async def fake_delete(torrent_hash, sid, delete_files=False):
        deleted.append((torrent_hash, sid, delete_files))
        return True

    monkeypatch.setattr(alerts, "qb_login", _sid)
    monkeypatch.setattr(alerts, "qb_get_torrents", fake_get_torrents)
    monkeypatch.setattr(alerts, "qb_get_torrent_trackers", _trackers)
    monkeypatch.setattr(alerts, "extract_mteam_id_from_trackers", lambda _trackers: "123")
    monkeypatch.setattr(alerts, "qb_delete_torrent", fake_delete)

    await alerts.check_emergency_alerts(
        [_free_torrent("999", minutes_remaining=60)],
        current_free_membership_complete=False,
    )

    assert deleted == []


@pytest.mark.asyncio
async def test_auto_delete_disabled_does_not_delete(monkeypatch):
    state.auto_delete_enabled = False
    deleted = []

    async def fake_delete(torrent_hash, sid, delete_files=False):
        deleted.append((torrent_hash, sid, delete_files))
        return True

    monkeypatch.setattr(alerts, "qb_login", _sid)
    monkeypatch.setattr(alerts, "qb_get_torrents", lambda *_args: [_downloading_task()])
    monkeypatch.setattr(alerts, "qb_get_torrent_trackers", _trackers)
    monkeypatch.setattr(alerts, "extract_mteam_id_from_trackers", lambda _trackers: "123")
    monkeypatch.setattr(alerts, "qb_delete_torrent", fake_delete)

    await alerts.check_emergency_alerts([_free_torrent("123", minutes_remaining=5)])

    assert deleted == []


@pytest.mark.asyncio
async def test_auto_delete_expiring_free_torrent_retries_during_alert_cooldown(monkeypatch):
    deleted = []
    sent = []

    async def fake_get_torrents(_sid):
        return [_downloading_task()]

    async def fake_delete(torrent_hash, sid, delete_files=False):
        deleted.append((torrent_hash, sid, delete_files))
        return True

    async def fake_send(title, content):
        sent.append((title, content))
        return True

    monkeypatch.setattr(alerts, "PUSHPLUS_TOKEN", "token")
    monkeypatch.setattr(alerts, "can_send_alert", lambda *_args, **_kwargs: False)
    monkeypatch.setattr(alerts, "send_pushplus_alert", fake_send)
    monkeypatch.setattr(alerts, "qb_login", _sid)
    monkeypatch.setattr(alerts, "qb_get_torrents", fake_get_torrents)
    monkeypatch.setattr(alerts, "qb_get_torrent_trackers", _trackers)
    monkeypatch.setattr(alerts, "extract_mteam_id_from_trackers", lambda _trackers: "123")
    monkeypatch.setattr(alerts, "qb_delete_torrent", fake_delete)

    await alerts.check_emergency_alerts([_free_torrent("123", minutes_remaining=5)])

    assert deleted == [("hash-123", "sid", True)]
    assert sent == []


@pytest.mark.asyncio
async def test_auto_delete_changed_free_torrent_retries_during_alert_cooldown(monkeypatch):
    state.known_free_torrent_ids.add("123")
    deleted = []
    sent = []

    async def fake_get_torrents(_sid):
        return [_downloading_task()]

    async def fake_delete(torrent_hash, sid, delete_files=False):
        deleted.append((torrent_hash, sid, delete_files))
        return True

    async def fake_send(title, content):
        sent.append((title, content))
        return True

    monkeypatch.setattr(alerts, "PUSHPLUS_TOKEN", "token")
    monkeypatch.setattr(alerts, "can_send_alert", lambda *_args, **_kwargs: False)
    monkeypatch.setattr(alerts, "send_pushplus_alert", fake_send)
    monkeypatch.setattr(alerts, "qb_login", _sid)
    monkeypatch.setattr(alerts, "qb_get_torrents", fake_get_torrents)
    monkeypatch.setattr(alerts, "qb_get_torrent_trackers", _trackers)
    monkeypatch.setattr(alerts, "extract_mteam_id_from_trackers", lambda _trackers: "123")
    monkeypatch.setattr(alerts, "qb_delete_torrent", fake_delete)

    await alerts.check_emergency_alerts([_free_torrent("999", minutes_remaining=60)])

    assert deleted == [("hash-123", "sid", True)]
    assert sent == []
