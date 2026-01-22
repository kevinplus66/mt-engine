"""
HTTP 客户端管理
"""

from typing import Optional, Dict
import asyncio
import httpx
from app.config import USER_AGENT, MT_TOKEN


# 全局 HTTP 客户端（复用连接池）
http_client: Optional[httpx.AsyncClient] = None
_client_lock: Optional[asyncio.Lock] = None


def _get_lock() -> asyncio.Lock:
    """获取或创建锁（延迟初始化）"""
    global _client_lock
    if _client_lock is None:
        _client_lock = asyncio.Lock()
    return _client_lock


async def get_http_client() -> httpx.AsyncClient:
    """获取或创建 HTTP 客户端（线程安全）"""
    global http_client
    if http_client is None or http_client.is_closed:
        async with _get_lock():
            # Double-check after acquiring lock
            if http_client is None or http_client.is_closed:
                http_client = httpx.AsyncClient(timeout=30.0)
    return http_client


def get_headers() -> Dict[str, str]:
    """获取 API 请求头"""
    return {
        "User-Agent": USER_AGENT,
        "x-api-key": MT_TOKEN.strip(),
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
