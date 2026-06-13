import pytest

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routes import home


class FakeUpstreamResponse:
    def __init__(self, status_code, content=b"", headers=None):
        self.status_code = status_code
        self.content = content
        self.headers = headers or {}


class FakeHttpClient:
    def __init__(self, result=None, exc=None):
        self.result = result
        self.exc = exc
        self.calls = []

    async def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        if self.exc is not None:
            raise self.exc
        return self.result


def make_client(monkeypatch, fake_http=None):
    if fake_http is not None:
        async def fake_get_http_client():
            return fake_http

        monkeypatch.setattr(home, "get_http_client", fake_get_http_client)

    app = FastAPI()
    app.include_router(home.router)
    return TestClient(app)

def stub_resolved_ips(monkeypatch, ips):
    calls = []

    def fake_resolve_host_ips(hostname):
        calls.append(hostname)
        return list(ips)

    monkeypatch.setattr(home, "_resolve_host_ips", fake_resolve_host_ips, raising=False)
    return calls


def test_home_poster_rejects_non_allowlisted_host(monkeypatch):
    client = make_client(monkeypatch)

    response = client.get("/api/home/poster", params={"u": "https://example.com/x.jpg"})

    assert response.status_code == 400


def test_home_poster_fetches_douban_with_referer_and_returns_image(monkeypatch):
    fake_http = FakeHttpClient(
        FakeUpstreamResponse(200, b"webp-bytes", {"content-type": "image/webp"})
    )
    resolver_calls = stub_resolved_ips(monkeypatch, ["1.2.3.4"])
    client = make_client(monkeypatch, fake_http)
    url = "https://img9.doubanio.com/view/photo/l/public/p123456.webp"

    response = client.get("/api/home/poster", params={"u": url})

    assert response.status_code == 200
    assert response.content == b"webp-bytes"
    assert response.headers["content-type"] == "image/webp"
    assert response.headers["cache-control"] == "public, max-age=86400"
    assert resolver_calls == ["img9.doubanio.com"]
    assert fake_http.calls[0][0] == url
    request_kwargs = fake_http.calls[0][1]
    assert request_kwargs["follow_redirects"] is False
    assert request_kwargs["headers"]["Referer"] == "https://movie.douban.com/"
    assert request_kwargs["headers"]["User-Agent"]


def test_home_poster_returns_502_for_redirect_response(monkeypatch):
    fake_http = FakeHttpClient(
        FakeUpstreamResponse(
            302,
            b"",
            {"location": "http://169.254.169.254/latest/meta-data/"},
        )
    )
    resolver_calls = stub_resolved_ips(monkeypatch, ["1.2.3.4"])
    client = make_client(monkeypatch, fake_http)
    url = "https://img9.doubanio.com/view/photo/l/public/p123456.webp"

    response = client.get("/api/home/poster", params={"u": url})

    assert response.status_code == 502
    assert resolver_calls == ["img9.doubanio.com"]
    assert fake_http.calls[0][1]["follow_redirects"] is False


@pytest.mark.parametrize("resolved_ip", ["127.0.0.1", "10.0.0.5", "169.254.169.254"])
def test_home_poster_rejects_allowlisted_host_resolving_to_non_public_ip(
    monkeypatch, resolved_ip
):
    fake_http = FakeHttpClient(FakeUpstreamResponse(200, b"image"))
    resolver_calls = stub_resolved_ips(monkeypatch, [resolved_ip])
    client = make_client(monkeypatch, fake_http)

    response = client.get(
        "/api/home/poster",
        params={"u": "https://image.tmdb.org/t/p/w500/private.jpg"},
    )

    assert response.status_code == 400
    assert resolver_calls == ["image.tmdb.org"]
    assert fake_http.calls == []


def test_home_poster_returns_502_for_upstream_non_success(monkeypatch):
    fake_http = FakeHttpClient(FakeUpstreamResponse(404, b"missing"))
    stub_resolved_ips(monkeypatch, ["1.2.3.4"])
    client = make_client(monkeypatch, fake_http)

    response = client.get(
        "/api/home/poster",
        params={"u": "https://image.tmdb.org/t/p/w500/missing.jpg"},
    )

    assert response.status_code == 502


def test_home_poster_returns_502_for_upstream_exception(monkeypatch):
    fake_http = FakeHttpClient(exc=TimeoutError("slow"))
    stub_resolved_ips(monkeypatch, ["1.2.3.4"])
    client = make_client(monkeypatch, fake_http)

    response = client.get(
        "/api/home/poster",
        params={"u": "https://image.tmdb.org/t/p/w500/missing.jpg"},
    )

    assert response.status_code == 502
