from typing import Any, Optional

import pytest

from app.services import mteam_api
from app.services.mteam_api import MTClient
from app.services.runtime_status import runtime_status


class _FakeResponse:
    def __init__(
        self,
        status_code: int = 200,
        payload: Any = None,
        json_error: Optional[Exception] = None,
    ):
        self.status_code = status_code
        self._payload = payload
        self._json_error = json_error

    def json(self):
        if self._json_error is not None:
            raise self._json_error
        return self._payload


class _FakeHTTPClient:
    def __init__(self, response):
        self._response = response

    async def post(self, url, **kwargs):
        return self._response


@pytest.fixture(autouse=True)
def reset_runtime_status():
    runtime_status.reset()
    yield
    runtime_status.reset()


def _patch_client(monkeypatch, response):
    async def fake_get_http_client():
        return _FakeHTTPClient(response)

    monkeypatch.setattr(mteam_api, "get_http_client", fake_get_http_client)
    monkeypatch.setattr(mteam_api, "MT_TOKEN", "token")


async def _search_adult_page_one(client):
    return await client._search_free_torrents_page(
        "FREE",
        mode="adult",
        page=1,
        page_size=100,
        sort_field=None,
        sort_direction=None,
    )


@pytest.mark.asyncio
async def test_http_error_status_is_propagated_into_shard_error(monkeypatch):
    _patch_client(
        monkeypatch,
        _FakeResponse(status_code=503, json_error=ValueError("not json")),
    )
    client = MTClient(request_delay=0)

    result = await _search_adult_page_one(client)

    assert result.succeeded is False
    assert "HTTP 503" in result.error
    assert runtime_status.mteam.ok is False
    assert "HTTP 503" in str(runtime_status.mteam.last_error)


@pytest.mark.asyncio
async def test_business_error_message_is_propagated_into_shard_error(monkeypatch):
    _patch_client(
        monkeypatch,
        _FakeResponse(payload={"code": "1", "message": "rate limit exceeded", "data": None}),
    )
    client = MTClient(request_delay=0)

    result = await _search_adult_page_one(client)

    assert result.succeeded is False
    assert "rate limit exceeded" in result.error


@pytest.mark.asyncio
async def test_non_json_200_response_is_labeled_as_non_json(monkeypatch):
    _patch_client(
        monkeypatch,
        _FakeResponse(status_code=200, json_error=ValueError("invalid body")),
    )
    client = MTClient(request_delay=0)

    result = await _search_adult_page_one(client)

    assert result.succeeded is False
    assert "响应非 JSON" in result.error


@pytest.mark.asyncio
async def test_network_exception_is_propagated_into_shard_error(monkeypatch):
    class _RaisingHTTPClient:
        async def post(self, url, **kwargs):
            raise TimeoutError("read timed out")

    async def fake_get_http_client():
        return _RaisingHTTPClient()

    monkeypatch.setattr(mteam_api, "get_http_client", fake_get_http_client)
    monkeypatch.setattr(mteam_api, "MT_TOKEN", "token")
    client = MTClient(request_delay=0)

    result = await _search_adult_page_one(client)

    assert result.succeeded is False
    assert "TimeoutError" in result.error
