import os
import re

os.environ["DEBUG"] = "true"


from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

import app.config as config
import app.routes.panel as panel_routes
from app import main
from app.security import require_api_key

client = TestClient(main.app)

MUTATING_METHODS = {"DELETE", "PATCH", "POST", "PUT"}
SECURITY_SCHEMES = ("BearerAuth", "ApiKeyAuth")


def _is_api_path(path):
    return path == "/api" or path.startswith("/api/")


def _mutating_api_routes():
    return [
        route
        for route in main.app.routes
        if isinstance(route, APIRoute)
        and _is_api_path(route.path)
        and route.methods
        and MUTATING_METHODS.intersection(route.methods)
    ]


def _mutating_methods(route):
    return sorted(MUTATING_METHODS.intersection(route.methods or ()))


def _route_requires_api_key(route):
    dependencies = list(route.dependant.dependencies)
    while dependencies:
        dependency = dependencies.pop()
        if dependency.call is require_api_key:
            return True
        dependencies.extend(dependency.dependencies)
    return False


def _sample_path(path):
    return re.sub(r"\{[^}:]+(?::[^}]+)?\}", "test", path)


def _request(method, path, payload=None, headers=None):
    if payload is None:
        return client.request(method, path, headers=headers or {})
    return client.request(method, path, json=payload, headers=headers or {})


def _post(path, payload=None, headers=None):
    return _request("POST", path, payload, headers)


def test_read_only_endpoints_remain_public_when_api_key_is_required(monkeypatch):
    monkeypatch.setattr(config, "DEBUG", False)
    monkeypatch.delenv("MT_ENGINE_API_KEY", raising=False)

    response = client.get("/api/pilot/config")

    assert response.status_code == 200


def test_mutating_api_routes_require_api_key_dependency():
    routes = _mutating_api_routes()
    assert routes
    for route in routes:
        assert _route_requires_api_key(route), route.path


def test_openapi_security_contract_for_protected_mutators():
    main.app.openapi_schema = None
    schema = main.app.openapi()

    security_schemes = schema["components"]["securitySchemes"]
    bearer_scheme = security_schemes["BearerAuth"]
    assert bearer_scheme["type"] == "http"
    assert bearer_scheme["scheme"] == "bearer"

    api_key_scheme = security_schemes["ApiKeyAuth"]
    assert api_key_scheme["type"] == "apiKey"
    assert api_key_scheme["in"] == "header"
    assert api_key_scheme["name"] == "X-MT-ENGINE-Key"

    routes = _mutating_api_routes()
    assert routes
    for route in routes:
        for method in _mutating_methods(route):
            operation = schema["paths"][route.path][method.lower()]
            security = operation.get("security", [])
            for scheme_name in SECURITY_SCHEMES:
                assert {scheme_name: []} in security, f"{method} {route.path}"


def test_mutating_requests_fail_closed_without_configured_api_key(monkeypatch):
    monkeypatch.setattr(config, "DEBUG", False)
    monkeypatch.delenv("MT_ENGINE_API_KEY", raising=False)

    routes = _mutating_api_routes()
    assert routes
    for route in routes:
        for method in _mutating_methods(route):
            response = _request(method, _sample_path(route.path), payload={})
            assert response.status_code == 403, f"{method} {route.path}"


def test_mutating_request_rejects_missing_or_invalid_api_key(monkeypatch):
    monkeypatch.setattr(config, "DEBUG", False)
    monkeypatch.setenv("MT_ENGINE_API_KEY", "correct-key")

    missing_response = _post("/api/panel/torrents/pause", {"hashes": []})
    invalid_response = _post(
        "/api/panel/torrents/pause",
        {"hashes": []},
        headers={"Authorization": "Bearer wrong-key"},
    )

    assert missing_response.status_code == 401
    assert invalid_response.status_code == 401


def test_bearer_or_header_api_key_reaches_endpoint_behavior(monkeypatch):
    async def fail_qb_login():
        return None

    monkeypatch.setattr(config, "DEBUG", False)
    monkeypatch.setenv("MT_ENGINE_API_KEY", "correct-key")
    monkeypatch.setattr(panel_routes, "qb_login", fail_qb_login)

    bearer_response = _post(
        "/api/panel/torrents/pause",
        {"hashes": ["abc"]},
        headers={"Authorization": "Bearer correct-key"},
    )
    header_response = _post(
        "/api/panel/torrents/resume",
        {"hashes": ["abc"]},
        headers={"X-MT-ENGINE-Key": "correct-key"},
    )

    assert bearer_response.status_code not in (401, 403)
    bearer_body = bearer_response.json()
    assert bearer_body["success"] is False
    assert bearer_body["paused_count"] == 0
    assert bearer_body["failed"] == ["abc"]
    assert "error" in bearer_body

    assert header_response.status_code not in (401, 403)
    header_body = header_response.json()
    assert header_body["success"] is False
    assert header_body["resumed_count"] == 0
    assert header_body["failed"] == ["abc"]
    assert "error" in header_body


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
