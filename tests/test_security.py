from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

import app.routes.panel as panel_routes
from app import main

client = TestClient(main.app)


def _is_api_path(path):
    return path == "/api" or path.startswith("/api/")


def _api_routes():
    return [
        route
        for route in main.app.routes
        if isinstance(route, APIRoute) and _is_api_path(route.path)
    ]


def _route_dependencies(route):
    dependencies = list(route.dependant.dependencies)
    while dependencies:
        dependency = dependencies.pop()
        yield dependency
        dependencies.extend(dependency.dependencies)


def _post(path, payload=None):
    if payload is None:
        return client.post(path)
    return client.post(path, json=payload)


def test_api_routes_do_not_depend_on_removed_api_key_auth():
    routes = _api_routes()
    assert routes

    for route in routes:
        for dependency in _route_dependencies(route):
            call = dependency.call
            assert getattr(call, "__name__", None) != "require" + "_api_key", route.path
            assert getattr(call, "__module__", None) != "app" + ".security", route.path


def test_panel_delete_defaults_to_preserving_files_when_delete_files_omitted(monkeypatch):
    calls = []

    async def fake_qb_login():
        return "sid"

    async def fake_qb_delete_torrents(sid, hashes, delete_files=True):
        calls.append({"sid": sid, "hashes": hashes, "delete_files": delete_files})
        return {"success": True, "deleted_count": len(hashes), "failed": []}

    monkeypatch.setattr(panel_routes, "qb_login", fake_qb_login)
    monkeypatch.setattr(panel_routes, "qb_delete_torrents", fake_qb_delete_torrents)

    response = _post(
        "/api/panel/torrents/delete",
        {"hashes": ["hash-1"]},
    )

    assert response.status_code == 200
    assert response.json()["success"] is True
    assert calls == [{"sid": "sid", "hashes": ["hash-1"], "delete_files": False}]


def test_panel_delete_explicit_true_still_deletes_files(monkeypatch):
    calls = []

    async def fake_qb_login():
        return "sid"

    async def fake_qb_delete_torrents(sid, hashes, delete_files=True):
        calls.append({"sid": sid, "hashes": hashes, "delete_files": delete_files})
        return {"success": True, "deleted_count": len(hashes), "failed": []}

    monkeypatch.setattr(panel_routes, "qb_login", fake_qb_login)
    monkeypatch.setattr(panel_routes, "qb_delete_torrents", fake_qb_delete_torrents)

    response = _post(
        "/api/panel/torrents/delete",
        {"hashes": ["hash-1"], "delete_files": True},
    )

    assert response.status_code == 200
    assert response.json()["success"] is True
    assert calls == [{"sid": "sid", "hashes": ["hash-1"], "delete_files": True}]


def test_safe_frontend_file_serves_from_frontend_root(monkeypatch, tmp_path):
    index_path = tmp_path / "index.html"
    index_path.write_text("<h1>MT Engine</h1>", encoding="utf-8")
    monkeypatch.setattr(main, "FRONTEND_DIR", tmp_path)

    response = client.get("/")

    assert response.status_code == 200
    assert "MT Engine" in response.text


def test_encoded_traversal_does_not_fall_back_or_escape_frontend(monkeypatch, tmp_path):
    index_path = tmp_path / "index.html"
    index_path.write_text("<h1>MT Engine</h1>", encoding="utf-8")
    monkeypatch.setattr(main, "FRONTEND_DIR", tmp_path)

    response = client.get("/%2e%2e/app/main.py")

    assert response.status_code == 404
