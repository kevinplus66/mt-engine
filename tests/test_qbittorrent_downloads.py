import logging

import pytest

import app.config as config
from app.services import qbittorrent_downloads as downloads
from app.services.mteam_api import MTClient


class FakeResponse:
    def __init__(self, *, status_code=200, payload=None, content=b""):
        self.status_code = status_code
        self._payload = payload or {}
        self.content = content
        self.text = repr(self._payload)

    def json(self):
        return self._payload


class FakeHttpClient:
    def __init__(self, post_response=None, get_response=None):
        self.post_response = post_response
        self.get_response = get_response
        self.post_calls = []
        self.get_calls = []

    async def post(self, url, **kwargs):
        self.post_calls.append((url, kwargs))
        return self.post_response

    async def get(self, url, **kwargs):
        self.get_calls.append((url, kwargs))
        return self.get_response


class FakeMTClient:
    def __init__(self, token):
        self.token = token
        self.calls = []

    async def get_torrent_download_token(self, torrent_id):
        self.calls.append(torrent_id)
        return self.token


def _install_fake_dependencies(monkeypatch, fake_mt_client, fake_http=None):
    monkeypatch.setattr(config, "MT_TOKEN", "configured-mteam-token")
    monkeypatch.setattr(downloads, "mt_client", fake_mt_client)

    if fake_http is not None:
        async def fake_get_http_client():
            return fake_http

        monkeypatch.setattr(downloads, "get_http_client", fake_get_http_client)


@pytest.mark.asyncio
async def test_gen_dl_token_signed_url_success_redacts_secret_response_data(
    monkeypatch, caplog
):
    sentinel_url = "https://signed.example/download?token=SENTINEL_SIGNED_URL_SECRET"
    fake_mt_client = FakeMTClient(sentinel_url)
    _install_fake_dependencies(monkeypatch, fake_mt_client)

    with caplog.at_level(logging.INFO):
        download_url = await downloads.get_torrent_download_url("12345")

    assert download_url == sentinel_url
    assert "ID=12345" in caplog.text
    assert fake_mt_client.calls == ["12345"]
    assert sentinel_url not in caplog.text
    assert "SENTINEL_SIGNED_URL_SECRET" not in caplog.text


@pytest.mark.asyncio
async def test_download_torrent_file_preserves_token_url_behavior_without_logging_token(
    monkeypatch, caplog
):
    sentinel_token = "SENTINEL_DOWNLOAD_TOKEN_SECRET"
    torrent_id = "98765"
    expected_url = (
        f"https://site.example/api/rss/dl?id={torrent_id}&token={sentinel_token}"
    )
    torrent_content = b"d8:announce13:https://trackere"
    fake_http = FakeHttpClient(
        get_response=FakeResponse(status_code=200, content=torrent_content)
    )
    fake_mt_client = FakeMTClient(sentinel_token)
    _install_fake_dependencies(monkeypatch, fake_mt_client, fake_http)
    monkeypatch.setattr(downloads, "MT_SITE_URL", "https://site.example")

    with caplog.at_level(logging.INFO):
        content = await downloads.download_torrent_file(torrent_id)

    assert content == torrent_content
    assert fake_http.get_calls[0][0] == expected_url
    assert "ID=98765" in caplog.text
    assert fake_mt_client.calls == [torrent_id]
    assert fake_http.post_calls == []
    assert expected_url not in caplog.text
    assert sentinel_token not in caplog.text


@pytest.mark.asyncio
async def test_get_torrent_download_url_uses_mt_client_not_raw_http(monkeypatch):
    sentinel_token = "SENTINEL_DOWNLOAD_TOKEN_SECRET"
    fake_mt_client = FakeMTClient(sentinel_token)
    get_http_client_calls = []

    async def fake_get_http_client():
        get_http_client_calls.append(True)
        return FakeHttpClient()

    monkeypatch.setattr(config, "MT_TOKEN", "configured-mteam-token")
    monkeypatch.setattr(downloads, "mt_client", fake_mt_client)
    monkeypatch.setattr(downloads, "get_http_client", fake_get_http_client)
    monkeypatch.setattr(downloads, "MT_SITE_URL", "https://site.example")

    download_url = await downloads.get_torrent_download_url("24680")

    assert download_url == (
        "https://site.example/api/rss/dl?id=24680"
        "&token=SENTINEL_DOWNLOAD_TOKEN_SECRET"
    )
    assert fake_mt_client.calls == ["24680"]
    assert get_http_client_calls == []


@pytest.mark.asyncio
async def test_mt_client_gen_dl_token_uses_shared_request_headers_and_label(monkeypatch):
    client = MTClient(request_delay=0)
    calls = []

    async def fake_request(url, **kwargs):
        calls.append((url, kwargs))
        return "SENTINEL_DOWNLOAD_TOKEN_SECRET"

    monkeypatch.setattr(client, "_request", fake_request)

    token = await client.get_torrent_download_token("13579")

    assert token == "SENTINEL_DOWNLOAD_TOKEN_SECRET"
    assert calls[0][0].endswith("/torrent/genDlToken")
    assert calls[0][1]["params"] == {"id": "13579"}
    assert "Content-Type" not in calls[0][1]["headers"]
    assert "13579" in calls[0][1]["label"]
    assert "SENTINEL_DOWNLOAD_TOKEN_SECRET" not in calls[0][1]["label"]
