"""
种子相关 API 路由
"""

from typing import Optional
from fastapi import Request, Query, HTTPException

from app.models import DownloadRequest
from app.state import auto_delete_enabled
from app.core.torrent import fetch_all_free_torrents
from app.services.qbittorrent import (
    download_torrent_file, qb_login, qb_add_torrent_file
)
from app.constants import QB_TAG_FREE_SEED
from app.config import QBITTORRENT_URL, QBITTORRENT_USER, QBITTORRENT_PASSWORD, logger
import app.state as state


async def api_torrents(
    discount: Optional[str] = Query(None, description="筛选优惠类型: FREE, _2X_FREE"),
    min_size: Optional[int] = Query(None, description="最小大小(字节)"),
    max_size: Optional[int] = Query(None, description="最大大小(字节)"),
    category: Optional[str] = Query(None, description="类别ID"),
    mode: Optional[str] = Query(None, description="频道: normal, adult")
):
    """API 接口返回 JSON 数据，支持筛选"""
    torrents = state.cached_data.get("torrents", [])

    if discount:
        torrents = [t for t in torrents if t["discount"] == discount]
    if min_size is not None:
        torrents = [t for t in torrents if t["size"] >= min_size]
    if max_size is not None:
        torrents = [t for t in torrents if t["size"] <= max_size]
    if category:
        torrents = [t for t in torrents if str(t["category"]) == category]
    if mode:
        torrents = [t for t in torrents if t["mode"] == mode]

    return {
        **state.cached_data,
        "torrents": torrents,
        "filtered_count": len(torrents)
    }


async def api_refresh(request: Request, check_rate_limit_func):
    """手动触发刷新"""
    # Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit_func(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait.")

    await fetch_all_free_torrents()
    return {"status": "ok", "message": "刷新完成"}


async def api_download_torrent(request: Request, data: DownloadRequest, check_rate_limit_func):
    """从 Free Hunter 下载种子到 qBittorrent (标签: 免费做种)"""
    # Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit_func(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests")

    # 检查 qBittorrent 配置
    if not QBITTORRENT_URL or not QBITTORRENT_USER or not QBITTORRENT_PASSWORD:
        return {"success": False, "error": "qb_not_configured", "message": "qBittorrent 未配置"}

    # 服务器端下载 .torrent 文件（避免 qBittorrent 无法访问 M-Team 的问题）
    torrent_content = await download_torrent_file(data.id)
    if not torrent_content:
        return {"success": False, "error": "download_link_failed", "message": "获取种子文件失败"}

    # 登录 qBittorrent
    sid = await qb_login()
    if not sid:
        return {"success": False, "error": "qb_connection_failed", "message": "qBittorrent 连接失败"}

    # 添加种子文件 (使用"免费做种"标签)
    success = await qb_add_torrent_file(torrent_content, sid, tag=QB_TAG_FREE_SEED)

    if success:
        return {"success": True, "message": "已添加到下载队列"}
    else:
        return {"success": False, "error": "add_torrent_failed", "message": "添加种子失败"}


async def api_auto_delete_toggle(request: Request, check_rate_limit_func):
    """切换自动删除功能"""
    # Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit_func(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait.")

    # Toggle the state
    state.auto_delete_enabled = not state.auto_delete_enabled

    logger.info(f"自动删除功能已{'启用' if state.auto_delete_enabled else '禁用'}")

    return {
        "success": True,
        "enabled": state.auto_delete_enabled,
        "message": f"自动删除已{'启用' if state.auto_delete_enabled else '禁用'}"
    }


async def api_auto_delete_status():
    """获取自动删除功能状态"""
    return {
        "enabled": state.auto_delete_enabled,
        "qbittorrent_configured": bool(QBITTORRENT_URL and QBITTORRENT_USER and QBITTORRENT_PASSWORD)
    }


async def api_categories():
    """获取类别列表"""
    return {"categories": state.cached_data.get("categories", [])}
