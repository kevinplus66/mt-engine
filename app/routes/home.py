"""Read-only Home media wall API."""

import ipaddress
import socket
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Response

from app.models import MediaWallResponse
from app.services.http_client import get_http_client
from app.services.media_wall import (
    USER_AGENT,
    _is_allowlisted_poster_host,
    media_wall_service,
    proxy_media_wall_posters,
)

router = APIRouter()

POSTER_PROXY_TIMEOUT_SECONDS = 10.0
POSTER_CACHE_CONTROL = "public, max-age=86400"


@router.get("/api/home/poster", include_in_schema=False)
async def get_home_poster(u: str):
    """Fetch an allowlisted upstream poster image through a same-origin proxy."""
    try:
        parsed = urlparse(u)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid poster URL") from exc
    hostname = parsed.hostname
    if parsed.scheme not in {"http", "https"} or not _is_allowlisted_poster_host(hostname):
        raise HTTPException(status_code=400, detail="Invalid poster URL")
    if hostname is None or not _host_resolves_to_public_ips(hostname):
        raise HTTPException(status_code=400, detail="Invalid poster URL")

    headers = {"User-Agent": USER_AGENT}
    if _is_allowlisted_poster_host_for_suffix(hostname, "doubanio.com"):
        headers["Referer"] = "https://movie.douban.com/"

    try:
        client = await get_http_client()
        response = await client.get(
            u,
            headers=headers,
            follow_redirects=False,
            timeout=POSTER_PROXY_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Bad Gateway") from exc
    if 300 <= response.status_code < 400:
        raise HTTPException(status_code=502, detail="Bad Gateway")
    if not 200 <= response.status_code < 300:
        raise HTTPException(status_code=502, detail="Bad Gateway")

    return Response(
        content=response.content,
        media_type=response.headers.get("content-type") or "image/jpeg",
        headers={"Cache-Control": POSTER_CACHE_CONTROL},
    )


def _resolve_host_ips(hostname: str) -> list[str]:
    return [address[4][0] for address in socket.getaddrinfo(hostname, None)]


def _host_resolves_to_public_ips(hostname: str) -> bool:
    try:
        addresses = _resolve_host_ips(hostname)
    except Exception:
        return False
    return bool(addresses) and all(_is_public_ip_address(address) for address in addresses)


def _is_public_ip_address(address: str) -> bool:
    try:
        ip = ipaddress.ip_address(address)
    except ValueError:
        return False
    return not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def _is_allowlisted_poster_host_for_suffix(hostname: str, suffix: str) -> bool:
    normalized = hostname.rstrip(".").lower()
    return normalized == suffix or normalized.endswith(f".{suffix}")


@router.get("/api/home/media-wall", response_model=MediaWallResponse)
async def get_home_media_wall():
    """Return the cached Home media wall snapshot without refreshing M-Team."""
    return proxy_media_wall_posters(media_wall_service.get_snapshot())
