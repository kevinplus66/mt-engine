from types import SimpleNamespace

import pytest

from app.core import pilot_config_store
from app.models import DownloadPolicy, DownloadRequest
from app.routes import radar as radar_routes
from app.routes import torrents as torrents_routes
from app.services import qbittorrent as qb
from app.services import qbittorrent_session as qb_session
from app.services.runtime_status import runtime_status


MANAGED_HASH = "a" * 40
UNMANAGED_HASH = "b" * 40
OTHER_MANAGED_HASH = "c" * 40


class _Response:
    def __init__(self, status_code, json_data=None, text="Ok.", cookies=None):
        self.status_code = status_code
        self._json_data = json_data or {}
        self.text = text
        self.cookies = cookies or {}

    def json(self):
        return self._json_data


class _FakeClient:
    def __init__(self, responses, calls):
        self._responses = responses
        self._calls = calls

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def post(self, url, data=None, files=None, cookies=None, headers=None):
        self._calls.append(
            {
                "method": "post",
                "url": url,
                "data": data,
                "files": files,
                "cookies": cookies,
                "headers": headers,
            }
        )
        return self._responses.pop(0)

    async def get(self, url, params=None, cookies=None):
        self._calls.append({"method": "get", "url": url, "params": params, "cookies": cookies})
        return self._responses.pop(0)


def _client_factory(responses, calls):
    def factory(*_args, **_kwargs):
        return _FakeClient(responses, calls)

    return factory

async def _async_response(response, calls, params):
    calls.append(params)
    return response


@pytest.fixture(autouse=True)
def _qb_url(monkeypatch):
    runtime_status.reset()
    qb_session.qb_clear_session()
    monkeypatch.setattr(qb, "QBITTORRENT_URL", "http://qbittorrent")
    monkeypatch.setattr(qb_session, "QBITTORRENT_URL", "http://qbittorrent")
    monkeypatch.setattr(qb_session, "QBITTORRENT_USER", "admin")
    monkeypatch.setattr(qb_session, "QBITTORRENT_PASSWORD", "password")


@pytest.mark.asyncio
async def test_qb46_login_accepts_ok_sid_and_reuses_cookie(monkeypatch):
    calls = []
    monkeypatch.setattr(
        qb_session.httpx,
        "AsyncClient",
        _client_factory(
            [_Response(200, text="Ok.", cookies={"SID": "sid46"})],
            calls,
        ),
    )

    sid = await qb_session.qb_login()
    cached_sid = await qb_session.qb_login()

    assert sid == "sid46"
    assert cached_sid == "sid46"
    assert len(calls) == 1
    assert calls[0]["headers"] == {
        "Origin": "http://qbittorrent",
        "Referer": "http://qbittorrent/",
    }
    assert qb_session.qb_session_cookies("sid46") == {"SID": "sid46"}


@pytest.mark.asyncio
async def test_qb5_login_accepts_204_qbt_sid_cookie(monkeypatch):
    calls = []
    monkeypatch.setattr(
        qb_session,
        "QBITTORRENT_URL",
        "http://qbittorrent:8080",
    )
    monkeypatch.setattr(
        qb_session.httpx,
        "AsyncClient",
        _client_factory(
            [_Response(204, text="", cookies={"QBT_SID_8080": "sid5"})],
            calls,
        ),
    )

    sid = await qb_session.qb_login()

    assert sid == "sid5"
    assert calls[0]["headers"] == {
        "Origin": "http://qbittorrent:8080",
        "Referer": "http://qbittorrent:8080/",
    }
    assert qb_session.qb_session_cookies("sid5") == {"QBT_SID_8080": "sid5"}


@pytest.mark.asyncio
async def test_batch_rejects_all_selector_without_http_mutation(monkeypatch):
    calls = []

    async def fail_get_torrents(_sid):
        raise AssertionError("selector validation must run before qBittorrent reads")

    monkeypatch.setattr(qb, "qb_get_torrents", fail_get_torrents)
    monkeypatch.setattr(qb.httpx, "AsyncClient", _client_factory([_Response(200)], calls))

    result = await qb.qb_pause_torrents("sid", ["all"])

    assert result["success"] is False
    assert result["paused_count"] == 0
    assert result["failed"] == ["all"]
    assert calls == []


@pytest.mark.asyncio
async def test_batch_rejects_embedded_delimiter_without_http_mutation(monkeypatch):
    calls = []

    async def fail_get_torrents(_sid):
        raise AssertionError("selector validation must run before qBittorrent reads")

    monkeypatch.setattr(qb, "qb_get_torrents", fail_get_torrents)
    monkeypatch.setattr(qb.httpx, "AsyncClient", _client_factory([_Response(200)], calls))

    result = await qb.qb_delete_torrents("sid", ["abc|all"])

    assert result["success"] is False
    assert result["deleted_count"] == 0
    assert result["failed"] == ["abc|all"]
    assert calls == []


@pytest.mark.asyncio
async def test_batch_mutates_only_exact_managed_tag_hashes(monkeypatch):
    calls = []

    async def fake_get_torrents(_sid):
        return [
            {"hash": MANAGED_HASH, "tags": "other, PILOT"},
            {"hash": UNMANAGED_HASH, "tags": "PILOTING"},
            {"hash": OTHER_MANAGED_HASH, "tags": " 雷达下载 , other"},
        ]

    monkeypatch.setattr(qb, "qb_get_torrents", fake_get_torrents)
    monkeypatch.setattr(qb.httpx, "AsyncClient", _client_factory([_Response(200)], calls))

    result = await qb.qb_resume_torrents("sid", [MANAGED_HASH, UNMANAGED_HASH, OTHER_MANAGED_HASH])

    assert result == {"success": True, "resumed_count": 2, "failed": [UNMANAGED_HASH]}
    assert len(calls) == 1
    assert calls[0]["data"]["hashes"] == f"{MANAGED_HASH}|{OTHER_MANAGED_HASH}"


@pytest.mark.parametrize(
    ("operation", "expected_endpoint", "count_key"),
    [
        ("pause", "stop", "paused_count"),
        ("resume", "start", "resumed_count"),
    ],
)
@pytest.mark.asyncio
async def test_pause_resume_tries_qb5_endpoint_first(
    monkeypatch,
    operation,
    expected_endpoint,
    count_key,
):
    calls = []

    async def fake_get_torrents(_sid):
        return [{"hash": MANAGED_HASH, "tags": "PILOT"}]

    monkeypatch.setattr(qb, "qb_get_torrents", fake_get_torrents)
    monkeypatch.setattr(qb.httpx, "AsyncClient", _client_factory([_Response(200)], calls))

    if operation == "pause":
        result = await qb.qb_pause_torrents("sid", [MANAGED_HASH])
    else:
        result = await qb.qb_resume_torrents("sid", [MANAGED_HASH])

    assert result == {"success": True, count_key: 1, "failed": []}
    assert [call["url"].rsplit("/", 1)[-1] for call in calls] == [expected_endpoint]


@pytest.mark.parametrize(
    (
        "operation",
        "qb5_endpoint",
        "qb4_endpoint",
        "count_key",
        "unsupported_status",
        "unsupported_text",
    ),
    [
        ("pause", "stop", "pause", "paused_count", 404, "Not Found"),
        ("pause", "stop", "pause", "paused_count", 405, "Method Not Allowed"),
        ("resume", "start", "resume", "resumed_count", 404, "Not Found"),
        ("resume", "start", "resume", "resumed_count", 405, "Method Not Allowed"),
        ("resume", "start", "resume", "resumed_count", 400, "unsupported endpoint"),
    ],
)
@pytest.mark.asyncio
async def test_pause_resume_falls_back_to_qb4_endpoint_when_qb5_is_unsupported(
    monkeypatch,
    operation,
    qb5_endpoint,
    qb4_endpoint,
    count_key,
    unsupported_status,
    unsupported_text,
):
    calls = []

    async def fake_get_torrents(_sid):
        return [{"hash": MANAGED_HASH, "tags": "PILOT"}]

    monkeypatch.setattr(qb, "qb_get_torrents", fake_get_torrents)
    monkeypatch.setattr(
        qb.httpx,
        "AsyncClient",
        _client_factory(
            [_Response(unsupported_status, text=unsupported_text), _Response(200)],
            calls,
        ),
    )

    if operation == "pause":
        result = await qb.qb_pause_torrents("sid", [MANAGED_HASH])
    else:
        result = await qb.qb_resume_torrents("sid", [MANAGED_HASH])

    assert result == {"success": True, count_key: 1, "failed": []}
    assert [call["url"].rsplit("/", 1)[-1] for call in calls] == [qb5_endpoint, qb4_endpoint]


@pytest.mark.asyncio
async def test_batch_auth_failure_clears_session_and_retries_once(monkeypatch):
    calls = []
    cleared = []
    login_calls = []

    async def fake_get_torrents(_sid):
        return [{"hash": MANAGED_HASH, "tags": "PILOT"}]

    async def fake_login(force_new=False):
        login_calls.append(force_new)
        return "fresh-sid"

    monkeypatch.setattr(qb, "qb_get_torrents", fake_get_torrents)
    monkeypatch.setattr(qb, "qb_clear_session", lambda: cleared.append(True))
    monkeypatch.setattr(qb, "qb_login", fake_login)
    monkeypatch.setattr(qb.httpx, "AsyncClient", _client_factory([_Response(401), _Response(200)], calls))

    result = await qb.qb_pause_torrents("stale-sid", [MANAGED_HASH])

    assert result == {"success": True, "paused_count": 1, "failed": []}
    assert cleared == [True]
    assert login_calls == [True]
    assert [call["cookies"] for call in calls] == [{"SID": "stale-sid"}, {"SID": "fresh-sid"}]


@pytest.mark.asyncio
async def test_storage_auth_failure_clears_session_and_retries_once(monkeypatch):
    calls = []
    cleared = []
    login_calls = []

    async def fake_login(force_new=False):
        login_calls.append(force_new)
        return "fresh-sid"

    monkeypatch.setattr(qb, "qb_clear_session", lambda: cleared.append(True))
    monkeypatch.setattr(qb, "qb_login", fake_login)
    monkeypatch.setattr(
        qb.httpx,
        "AsyncClient",
        _client_factory([
            _Response(403),
            _Response(200, {"server_state": {"free_space_on_disk": 10}}),
        ], calls),
    )

    result = await qb.qb_get_storage_info("stale-sid")

    assert "error" not in result
    assert result["free"] == 10
    assert cleared == [True]
    assert login_calls == [True]
    assert [call["cookies"] for call in calls] == [{"SID": "stale-sid"}, {"SID": "fresh-sid"}]

@pytest.mark.asyncio
async def test_tracker_lookup_auth_failure_relogs_and_retries_once(monkeypatch):
    calls = []
    cleared = []
    login_calls = []
    trackers = [{"url": "https://tracker.m-team.cc/announce.php?passkey=abc"}]

    async def fake_login(force_new=False):
        login_calls.append(force_new)
        return "fresh-sid"

    monkeypatch.setattr(qb, "qb_clear_session", lambda: cleared.append(True))
    monkeypatch.setattr(qb, "qb_login", fake_login)
    monkeypatch.setattr(qb.httpx, "AsyncClient", _client_factory([_Response(401), _Response(200, trackers)], calls))

    result = await qb.qb_get_torrent_trackers(MANAGED_HASH, "stale-sid")

    assert result == trackers
    assert cleared == [True]
    assert login_calls == [True]
    assert [call["cookies"] for call in calls] == [{"SID": "stale-sid"}, {"SID": "fresh-sid"}]
    assert [call["params"] for call in calls] == [{"hash": MANAGED_HASH}, {"hash": MANAGED_HASH}]


@pytest.mark.parametrize("save_path", ["", "   ", "/", "..", "/downloads/..", "/etc/downloads", "/downloads2"])
def test_download_policy_rejects_unsafe_save_paths(save_path):
    with pytest.raises(ValueError):
        DownloadPolicy(save_path=save_path)


def test_download_policy_normalizes_download_save_paths():
    assert DownloadPolicy(save_path=" /downloads ").save_path == "/downloads"
    assert DownloadPolicy(save_path="/downloads/pilot/../safe/").save_path == "/downloads/safe"


@pytest.mark.parametrize("env_save_path", ["", "   "])
def test_pilot_save_path_env_override_ignores_blank_values(monkeypatch, tmp_path, env_save_path):
    monkeypatch.setattr(pilot_config_store, "CONFIG_PATH", tmp_path / "pilot.json")
    monkeypatch.setenv("PILOT_SAVE_PATH", env_save_path)

    config = pilot_config_store.load_pilot_config()

    assert config.download.save_path == "/downloads/mt_free_farm"


def test_pilot_save_path_env_override_normalizes_valid_download_path(monkeypatch, tmp_path):
    monkeypatch.setattr(pilot_config_store, "CONFIG_PATH", tmp_path / "pilot.json")
    monkeypatch.setenv("PILOT_SAVE_PATH", "/downloads/env/../safe")

    config = pilot_config_store.load_pilot_config()

    assert config.download.save_path == "/downloads/safe"


def test_pilot_save_path_env_override_rejects_non_empty_unsafe_path(monkeypatch, tmp_path):
    monkeypatch.setattr(pilot_config_store, "CONFIG_PATH", tmp_path / "pilot.json")
    monkeypatch.setenv("PILOT_SAVE_PATH", "/var/lib/qbittorrent")

    with pytest.raises(ValueError):
        pilot_config_store.load_pilot_config()


@pytest.mark.asyncio
async def test_add_torrent_file_rejects_unsafe_savepath_before_http(monkeypatch):
    calls = []
    monkeypatch.setattr(qb.httpx, "AsyncClient", _client_factory([_Response(200)], calls))

    result = await qb.qb_add_torrent_file(b"torrent", "sid", tag="PILOT", savepath="/etc")

    assert result is False
    assert calls == []

@pytest.mark.asyncio
async def test_add_torrent_file_persists_mteam_id_tag_without_tracker_lookup(monkeypatch):
    calls = []
    monkeypatch.setattr(qb.httpx, "AsyncClient", _client_factory([_Response(200)], calls))

    async def fail_tracker_lookup(*_args, **_kwargs):
        raise AssertionError("add path must persist MTID without tracker lookup")

    monkeypatch.setattr(qb, "qb_get_torrent_trackers", fail_tracker_lookup)

    result = await qb.qb_add_torrent_file(
        b"torrent",
        "sid",
        tag="PILOT",
        savepath="/downloads/safe",
        mteam_id="12345",
    )

    assert result is True
    assert calls[0]["data"]["tags"] == "PILOT,MTID:12345"
    assert calls[0]["data"]["savepath"] == "/downloads/safe"

@pytest.mark.asyncio
async def test_sonar_download_persists_mteam_id_tag(monkeypatch):
    added = []
    request = SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"))

    async def fake_add(content, sid, *, tag=None, savepath="", mteam_id=None):
        added.append({"content": content, "sid": sid, "tag": tag, "mteam_id": mteam_id})
        return True

    monkeypatch.setattr(torrents_routes, "QBITTORRENT_URL", "http://qb")
    monkeypatch.setattr(torrents_routes, "QBITTORRENT_USER", "user")
    monkeypatch.setattr(torrents_routes, "QBITTORRENT_PASSWORD", "pass")
    monkeypatch.setattr(torrents_routes, "qb_login", lambda: _async_response("sid", [], None))
    monkeypatch.setattr(torrents_routes, "qb_find_torrent_by_mteam_id", lambda _id, _sid: _async_response(None, [], None))
    monkeypatch.setattr(torrents_routes, "download_torrent_file", lambda _id: _async_response(b"torrent", [], None))
    monkeypatch.setattr(torrents_routes, "qb_add_torrent_file", fake_add)

    result = await torrents_routes.api_download_torrent(
        request,
        DownloadRequest(id="13579"),
        lambda _ip: True,
    )

    assert result["success"] is True
    assert added == [{"content": b"torrent", "sid": "sid", "tag": "声呐做种", "mteam_id": "13579"}]


@pytest.mark.asyncio
async def test_radar_download_persists_mteam_id_tag(monkeypatch):
    added = []
    request = SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"))

    async def fake_add(content, sid, *, tag=None, savepath="", mteam_id=None):
        added.append({"content": content, "sid": sid, "tag": tag, "mteam_id": mteam_id})
        return True

    monkeypatch.setattr(radar_routes, "QBITTORRENT_URL", "http://qb")
    monkeypatch.setattr(radar_routes, "QBITTORRENT_USER", "user")
    monkeypatch.setattr(radar_routes, "QBITTORRENT_PASSWORD", "pass")
    monkeypatch.setattr(radar_routes, "qb_login", lambda: _async_response("sid", [], None))
    monkeypatch.setattr(radar_routes, "qb_find_torrent_by_mteam_id", lambda _id, _sid: _async_response(None, [], None))
    monkeypatch.setattr(radar_routes, "download_torrent_file", lambda _id: _async_response(b"torrent", [], None))
    monkeypatch.setattr(radar_routes, "qb_add_torrent_file", fake_add)

    result = await radar_routes.radar_download_torrent(
        request,
        DownloadRequest(id="97531"),
        lambda _ip: True,
    )

    assert result["success"] is True
    assert added == [{"content": b"torrent", "sid": "sid", "tag": "雷达下载", "mteam_id": "97531"}]



@pytest.mark.asyncio
async def test_mtid_tag_fast_path_skips_tracker_lookup(monkeypatch):
    async def fake_get_torrents(_sid):
        return [
            {"hash": MANAGED_HASH, "tags": "PILOT, MTID:12345"},
            {"hash": OTHER_MANAGED_HASH, "tags": "雷达下载, MTID:24680"},
        ]

    async def fail_tracker_lookup(*_args, **_kwargs):
        raise AssertionError("MTID-tagged torrents must not fetch trackers for ID resolution")

    monkeypatch.setattr(qb, "qb_get_torrents", fake_get_torrents)
    monkeypatch.setattr(qb, "qb_get_torrent_trackers", fail_tracker_lookup)

    assert await qb.qb_get_existing_mteam_ids("sid") == {"12345", "24680"}
    assert await qb.qb_find_torrent_by_mteam_id("24680", "sid") == OTHER_MANAGED_HASH


@pytest.mark.asyncio
async def test_legacy_mteam_id_resolution_falls_back_to_trackers(monkeypatch):
    tracker_calls = []

    async def fake_get_torrents(_sid):
        return [{"hash": MANAGED_HASH, "tags": "PILOT"}]

    async def fake_get_torrent_trackers(torrent_hash, sid):
        tracker_calls.append((torrent_hash, sid))
        return [{"url": "https://tracker.m-team.cc/announce?torrent_id=67890", "status": 2}]

    monkeypatch.setattr(qb, "qb_get_torrents", fake_get_torrents)
    monkeypatch.setattr(qb, "qb_get_torrent_trackers", fake_get_torrent_trackers)

    assert await qb.qb_get_existing_mteam_ids("sid") == {"67890"}
    assert tracker_calls == [(MANAGED_HASH, "sid")]


@pytest.mark.asyncio
async def test_delete_torrent_auth_failure_relogs_and_retries_once(monkeypatch):
    calls = []
    cleared = []
    login_calls = []

    async def fake_login(force_new=False):
        login_calls.append(force_new)
        return "fresh-sid"

    monkeypatch.setattr(qb, "qb_clear_session", lambda: cleared.append(True))
    monkeypatch.setattr(qb, "qb_login", fake_login)
    monkeypatch.setattr(qb.httpx, "AsyncClient", _client_factory([_Response(401), _Response(200)], calls))

    result = await qb.qb_delete_torrent(MANAGED_HASH, "stale-sid", delete_files=True)

    assert result is True
    assert cleared == [True]
    assert login_calls == [True]
    assert [call["cookies"] for call in calls] == [{"SID": "stale-sid"}, {"SID": "fresh-sid"}]
    assert [call["data"]["deleteFiles"] for call in calls] == ["true", "true"]


@pytest.mark.asyncio
async def test_add_torrent_by_url_auth_failure_relogs_and_retries_once(monkeypatch):
    calls = []
    cleared = []
    login_calls = []

    async def fake_login(force_new=False):
        login_calls.append(force_new)
        return "fresh-sid"

    monkeypatch.setattr(qb, "qb_clear_session", lambda: cleared.append(True))
    monkeypatch.setattr(qb, "qb_login", fake_login)
    monkeypatch.setattr(qb.httpx, "AsyncClient", _client_factory([_Response(403), _Response(200)], calls))

    result = await qb.qb_add_torrent_by_url("https://example.test/meta.torrent", "stale-sid", tag="PILOT")

    assert result is True
    assert cleared == [True]
    assert login_calls == [True]
    assert [call["cookies"] for call in calls] == [{"SID": "stale-sid"}, {"SID": "fresh-sid"}]
    assert [call["data"]["tags"] for call in calls] == ["PILOT", "PILOT"]


@pytest.mark.asyncio
async def test_add_torrent_file_auth_failure_relogs_and_retries_once(monkeypatch):
    calls = []
    cleared = []
    login_calls = []
    torrent_content = b"torrent"

    async def fake_login(force_new=False):
        login_calls.append(force_new)
        return "fresh-sid"

    monkeypatch.setattr(qb, "qb_clear_session", lambda: cleared.append(True))
    monkeypatch.setattr(qb, "qb_login", fake_login)
    monkeypatch.setattr(qb.httpx, "AsyncClient", _client_factory([_Response(401), _Response(200)], calls))

    result = await qb.qb_add_torrent_file(torrent_content, "stale-sid", tag="PILOT", savepath="/downloads/safe")

    assert result is True
    assert cleared == [True]
    assert login_calls == [True]
    assert [call["cookies"] for call in calls] == [{"SID": "stale-sid"}, {"SID": "fresh-sid"}]
    assert calls[0]["files"] is calls[1]["files"]
    assert calls[0]["files"]["torrents"][1] is torrent_content


@pytest.mark.asyncio
async def test_delete_torrent_relogin_failure_does_not_retry(monkeypatch):
    calls = []
    cleared = []
    login_calls = []

    async def fake_login(force_new=False):
        login_calls.append(force_new)
        return None

    monkeypatch.setattr(qb, "qb_clear_session", lambda: cleared.append(True))
    monkeypatch.setattr(qb, "qb_login", fake_login)
    monkeypatch.setattr(qb.httpx, "AsyncClient", _client_factory([_Response(401)], calls))

    result = await qb.qb_delete_torrent(MANAGED_HASH, "stale-sid")

    assert result is False
    assert cleared == [True]
    assert login_calls == [True]
    assert [call["cookies"] for call in calls] == [{"SID": "stale-sid"}]


@pytest.mark.parametrize("operation", ["delete", "url", "file"])
@pytest.mark.asyncio
async def test_one_off_mutation_second_auth_failure_does_not_retry_again(monkeypatch, operation):
    calls = []
    cleared = []
    login_calls = []

    async def fake_login(force_new=False):
        login_calls.append(force_new)
        return "fresh-sid"

    monkeypatch.setattr(qb, "qb_clear_session", lambda: cleared.append(True))
    monkeypatch.setattr(qb, "qb_login", fake_login)
    monkeypatch.setattr(qb.httpx, "AsyncClient", _client_factory([_Response(401), _Response(403)], calls))

    if operation == "delete":
        result = await qb.qb_delete_torrent(MANAGED_HASH, "stale-sid")
    elif operation == "url":
        result = await qb.qb_add_torrent_by_url("https://example.test/meta.torrent", "stale-sid")
    else:
        result = await qb.qb_add_torrent_file(b"torrent", "stale-sid", savepath="/downloads/safe")

    assert result is False
    assert cleared == [True]
    assert login_calls == [True]
    assert [call["cookies"] for call in calls] == [{"SID": "stale-sid"}, {"SID": "fresh-sid"}]
