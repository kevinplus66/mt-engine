"""
qBittorrent session management.
"""

import asyncio
from datetime import datetime
from typing import Optional

import httpx

from app.config import (
    QB_SESSION_MAX_AGE,
    QBITTORRENT_PASSWORD,
    QBITTORRENT_URL,
    QBITTORRENT_USER,
    logger,
)
from app.services.runtime_status import runtime_status


qb_cached_sid: Optional[str] = None
qb_sid_created_at: Optional[float] = None
_qb_session_lock: Optional[asyncio.Lock] = None


def _get_qb_lock() -> asyncio.Lock:
    """Get or create qBittorrent session lock lazily."""
    global _qb_session_lock
    if _qb_session_lock is None:
        _qb_session_lock = asyncio.Lock()
    return _qb_session_lock


def qb_clear_session():
    """Clear cached qBittorrent session."""
    global qb_cached_sid, qb_sid_created_at
    qb_cached_sid = None
    qb_sid_created_at = None
    logger.debug("已清除 qBittorrent 缓存会话")


def qb_is_session_valid() -> bool:
    """Check whether cached session is still valid."""
    global qb_cached_sid, qb_sid_created_at
    if not qb_cached_sid or not qb_sid_created_at:
        return False

    elapsed = datetime.now().timestamp() - qb_sid_created_at
    return elapsed < QB_SESSION_MAX_AGE


async def qb_login(force_new: bool = False) -> Optional[str]:
    """
    Login to qBittorrent Web UI with session caching.
    """
    global qb_cached_sid, qb_sid_created_at

    if not QBITTORRENT_URL or not QBITTORRENT_USER or not QBITTORRENT_PASSWORD:
        logger.debug("qBittorrent 配置不完整，跳过登录")
        runtime_status.mark_error("qbittorrent", "qBittorrent 配置不完整")
        return None

    if not force_new and qb_is_session_valid():
        logger.debug("使用缓存的 qBittorrent 会话")
        return qb_cached_sid

    async with _get_qb_lock():
        if not force_new and qb_is_session_valid():
            logger.debug("使用缓存的 qBittorrent 会话（锁内检查）")
            return qb_cached_sid

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{QBITTORRENT_URL.rstrip('/')}/api/v2/auth/login",
                    data={
                        "username": QBITTORRENT_USER,
                        "password": QBITTORRENT_PASSWORD,
                    },
                )

                if response.text == "Ok.":
                    sid = response.cookies.get("SID")
                    if sid:
                        qb_cached_sid = sid
                        qb_sid_created_at = datetime.now().timestamp()
                        logger.info("qBittorrent 登录成功（新会话）")
                        runtime_status.mark_success("qbittorrent")
                        return sid

                    logger.warning("qBittorrent 登录成功但未获取到 SID")
                    runtime_status.mark_error("qbittorrent", "登录成功但未获取到 SID")
                    return None

                logger.error(f"qBittorrent 登录失败: {response.text}")
                runtime_status.mark_error("qbittorrent", response.text)
                qb_clear_session()
                return None
        except Exception as e:
            logger.error(f"qBittorrent 登录异常: {e}")
            runtime_status.mark_error("qbittorrent", e)
            qb_clear_session()
            return None
