import pytest

from app.core import pilot_config_store
from app.models import DownloadPolicy
from app.services import qbittorrent as qb


MANAGED_HASH = "a" * 40
UNMANAGED_HASH = "b" * 40
OTHER_MANAGED_HASH = "c" * 40


class _Response:
    def __init__(self, status_code, json_data=None, text="Ok."):
        self.status_code = status_code
        self._json_data = json_data or {}
        self.text = text

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

    async def post(self, url, data=None, files=None, cookies=None):
        self._calls.append({"method": "post", "url": url, "data": data, "files": files, "cookies": cookies})
        return self._responses.pop(0)

    async def get(self, url, cookies=None):
        self._calls.append({"method": "get", "url": url, "cookies": cookies})
        return self._responses.pop(0)


def _client_factory(responses, calls):
    def factory(*_args, **_kwargs):
        return _FakeClient(responses, calls)

    return factory


@pytest.fixture(autouse=True)
def _qb_url(monkeypatch):
    monkeypatch.setattr(qb, "QBITTORRENT_URL", "http://qbittorrent")


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
