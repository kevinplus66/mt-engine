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


def test_home_poster_rejects_non_allowlisted_host(monkeypatch):
    client = make_client(monkeypatch)

    response = client.get("/api/home/poster", params={"u": "https://example.com/x.jpg"})

    assert response.status_code == 400


def test_home_poster_fetches_douban_with_referer_and_returns_image(monkeypatch):
    fake_http = FakeHttpClient(
        FakeUpstreamResponse(200, b"webp-bytes", {"content-type": "image/webp"})
    )
    client = make_client(monkeypatch, fake_http)
    url = "https://img9.doubanio.com/view/photo/l/public/p123456.webp"

    response = client.get("/api/home/poster", params={"u": url})

    assert response.status_code == 200
    assert response.content == b"webp-bytes"
    assert response.headers["content-type"] == "image/webp"
    assert response.headers["cache-control"] == "public, max-age=86400"
    assert fake_http.calls[0][0] == url
    request_kwargs = fake_http.calls[0][1]
    assert request_kwargs["follow_redirects"] is True
    assert request_kwargs["headers"]["Referer"] == "https://movie.douban.com/"
    assert request_kwargs["headers"]["User-Agent"]


def test_home_poster_returns_502_for_upstream_non_success(monkeypatch):
    fake_http = FakeHttpClient(FakeUpstreamResponse(404, b"missing"))
    client = make_client(monkeypatch, fake_http)

    response = client.get(
        "/api/home/poster",
        params={"u": "https://image.tmdb.org/t/p/w500/missing.jpg"},
    )

    assert response.status_code == 502


def test_home_poster_returns_502_for_upstream_exception(monkeypatch):
    fake_http = FakeHttpClient(exc=TimeoutError("slow"))
    client = make_client(monkeypatch, fake_http)

    response = client.get(
        "/api/home/poster",
        params={"u": "https://image.tmdb.org/t/p/w500/missing.jpg"},
    )

    assert response.status_code == 502
