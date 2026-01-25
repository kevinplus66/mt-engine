"""
qBittorrent 集成服务
"""

import asyncio
import base64
import re
from typing import Optional, List, Dict
from datetime import datetime
import httpx

from app.config import (
    QBITTORRENT_URL, QBITTORRENT_USER, QBITTORRENT_PASSWORD,
    QB_SESSION_MAX_AGE, MT_API_BASE, MT_SITE_URL, USER_AGENT, logger
)
from app.services.http_client import get_http_client, get_headers


# ============ qBittorrent 会话缓存 ============
qb_cached_sid: Optional[str] = None
qb_sid_created_at: Optional[float] = None
_qb_session_lock: Optional[asyncio.Lock] = None


def _get_qb_lock() -> asyncio.Lock:
    """获取或创建 qBittorrent 会话锁（延迟初始化）"""
    global _qb_session_lock
    if _qb_session_lock is None:
        _qb_session_lock = asyncio.Lock()
    return _qb_session_lock


def qb_clear_session():
    """清除缓存的 qBittorrent 会话"""
    global qb_cached_sid, qb_sid_created_at
    qb_cached_sid = None
    qb_sid_created_at = None
    logger.debug("已清除 qBittorrent 缓存会话")


def qb_is_session_valid() -> bool:
    """检查缓存的会话是否仍然有效"""
    global qb_cached_sid, qb_sid_created_at
    if not qb_cached_sid or not qb_sid_created_at:
        return False

    elapsed = datetime.now().timestamp() - qb_sid_created_at
    return elapsed < QB_SESSION_MAX_AGE


async def qb_login(force_new: bool = False) -> Optional[str]:
    """
    登录 qBittorrent Web UI（带会话缓存，线程安全）

    Args:
        force_new: 是否强制重新登录（忽略缓存）

    Returns:
        Optional[str]: 登录成功返回 SID cookie，失败返回 None
    """
    global qb_cached_sid, qb_sid_created_at

    if not QBITTORRENT_URL or not QBITTORRENT_USER or not QBITTORRENT_PASSWORD:
        logger.debug("qBittorrent 配置不完整，跳过登录")
        return None

    # 如果有有效的缓存会话且不是强制重新登录，直接返回（无需锁）
    if not force_new and qb_is_session_valid():
        logger.debug("使用缓存的 qBittorrent 会话")
        return qb_cached_sid

    # 使用锁保护登录操作
    async with _get_qb_lock():
        # Double-check after acquiring lock
        if not force_new and qb_is_session_valid():
            logger.debug("使用缓存的 qBittorrent 会话（锁内检查）")
            return qb_cached_sid

        try:
            # 创建新的 HTTP 客户端实例，避免 cookie 干扰
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{QBITTORRENT_URL.rstrip('/')}/api/v2/auth/login",
                    data={"username": QBITTORRENT_USER, "password": QBITTORRENT_PASSWORD},
                )

                if response.text == "Ok.":
                    # 从 cookies 中提取 SID
                    sid = response.cookies.get("SID")
                    if sid:
                        # 缓存会话
                        qb_cached_sid = sid
                        qb_sid_created_at = datetime.now().timestamp()
                        logger.info("qBittorrent 登录成功（新会话）")
                        return sid
                    else:
                        logger.warning("qBittorrent 登录成功但未获取到 SID")
                        return None
                else:
                    logger.error(f"qBittorrent 登录失败: {response.text}")
                    qb_clear_session()  # 清除可能过期的缓存
                    return None
        except Exception as e:
            logger.error(f"qBittorrent 登录异常: {e}")
            qb_clear_session()
            return None


async def qb_get_torrents(sid: str) -> List[Dict]:
    """
    获取 qBittorrent 中的所有种子

    Args:
        sid: qBittorrent 会话 ID

    Returns:
        List[Dict]: 种子列表
    """
    if not sid:
        return []

    try:
        # 使用独立的客户端，避免 cookie 干扰
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{QBITTORRENT_URL.rstrip('/')}/api/v2/torrents/info",
                cookies={"SID": sid},
            )

            # 检查认证失败
            if response.status_code in (401, 403):
                logger.warning("qBittorrent 会话已过期，清除缓存")
                qb_clear_session()
                return []

            return response.json()
    except Exception as e:
        logger.error(f"获取 qBittorrent 种子列表失败: {e}")
        return []


async def qb_get_torrent_trackers(torrent_hash: str, sid: str) -> List[Dict]:
    """
    获取指定种子的 tracker 列表

    Args:
        torrent_hash: 种子哈希值
        sid: qBittorrent 会话 ID

    Returns:
        List[Dict]: Tracker 列表
    """
    if not sid:
        return []

    try:
        # 使用独立的客户端，避免 cookie 干扰
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{QBITTORRENT_URL.rstrip('/')}/api/v2/torrents/trackers",
                params={"hash": torrent_hash},
                cookies={"SID": sid},
            )

            # 检查认证失败
            if response.status_code in (401, 403):
                logger.warning("qBittorrent 会话已过期，清除缓存")
                qb_clear_session()
                return []

            return response.json()
    except Exception as e:
        logger.error(f"获取种子 tracker 失败: {e}")
        return []


async def qb_find_torrent_by_mteam_id(mteam_id: str, sid: str) -> Optional[str]:
    """
    通过 M-Team ID 查找 qBittorrent 中的种子

    Args:
        mteam_id: M-Team 种子 ID
        sid: qBittorrent 会话 ID

    Returns:
        Optional[str]: 找到返回种子哈希值，否则返回 None
    """
    torrents = await qb_get_torrents(sid)

    for torrent in torrents:
        torrent_hash = torrent.get("hash")
        if not torrent_hash:
            continue

        # 获取该种子的 trackers
        trackers = await qb_get_torrent_trackers(torrent_hash, sid)

        # 检查 tracker URL 中是否包含 M-Team ID
        for tracker in trackers:
            tracker_url = tracker.get("url", "")
            if "m-team" not in tracker_url.lower():
                continue

            # 方式1: 直接匹配 torrent_id=xxx
            if f"torrent_id={mteam_id}" in tracker_url:
                logger.info(f"找到 M-Team 种子 {mteam_id} 对应的 qBittorrent 种子: {torrent.get('name')}")
                return torrent_hash

            # 方式2: 解析 base64 编码的 credential 参数，查找 tid=xxx
            try:
                # 从 URL 中提取 credential 参数
                if "credential=" in tracker_url:
                    # 提取 credential 值
                    credential_match = re.search(r'credential=([A-Za-z0-9+/=]+)', tracker_url)
                    if credential_match:
                        credential_b64 = credential_match.group(1)
                        # Base64 解码
                        decoded = base64.b64decode(credential_b64).decode('utf-8', errors='ignore')
                        # 检查 tid=xxx
                        if f"tid={mteam_id}" in decoded:
                            logger.info(f"找到 M-Team 种子 {mteam_id} 对应的 qBittorrent 种子 (via credential): {torrent.get('name')}")
                            return torrent_hash
            except Exception as e:
                logger.debug(f"解析 credential 失败: {e}")
                continue

    return None


async def qb_delete_torrent(torrent_hash: str, sid: str, delete_files: bool = False) -> bool:
    """
    从 qBittorrent 删除种子

    Args:
        torrent_hash: 种子哈希值
        sid: qBittorrent 会话 ID
        delete_files: 是否同时删除文件（默认 False，仅删除种子）

    Returns:
        bool: 删除成功返回 True，否则返回 False
    """
    if not sid:
        return False

    try:
        # 使用独立的客户端，避免 cookie 干扰
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{QBITTORRENT_URL.rstrip('/')}/api/v2/torrents/delete",
                data={"hashes": torrent_hash, "deleteFiles": "true" if delete_files else "false"},
                cookies={"SID": sid},
            )

            # 检查认证失败
            if response.status_code in (401, 403):
                logger.warning("qBittorrent 会话已过期，清除缓存")
                qb_clear_session()
                return False

            if response.status_code == 200:
                logger.info(f"成功从 qBittorrent 删除种子: {torrent_hash}")
                return True
            else:
                logger.error(f"从 qBittorrent 删除种子失败: {response.text}")
                return False
    except Exception as e:
        logger.error(f"删除 qBittorrent 种子异常: {e}")
        return False


async def get_torrent_download_url(torrent_id: str) -> Optional[str]:
    """
    通过 M-Team API 获取种子下载链接

    Args:
        torrent_id: 种子 ID

    Returns:
        Optional[str]: 下载 URL，失败返回 None
    """
    from app.config import MT_TOKEN

    if not MT_TOKEN:
        logger.error(f"[下载] MT_TOKEN 未配置，无法获取种子 {torrent_id} 的下载链接")
        return None

    try:
        client = await get_http_client()
        logger.info(f"[下载] 请求种子下载链接: ID={torrent_id}")

        # Prepare headers: Remove Content-Type as we are sending params in query string (empty body)
        headers = get_headers()
        headers.pop("Content-Type", None)

        # API requires ID in query parameters, even for POST
        response = await client.post(
            f"{MT_API_BASE}/torrent/genDlToken",
            headers=headers,
            params={"id": torrent_id}
        )

        logger.info(f"[下载] API响应状态码: {response.status_code}")
        try:
            data = response.json()
        except Exception as e:
            logger.error(f"[下载] JSON解析失败 - ID={torrent_id}, error={e}, response text: {response.text[:200]}")
            return None

        # Robust check for code (handle both int and string "0")
        if str(data.get("code")) == "0":
            token = data.get("data")

            # Check if token is actually a full URL (V2 link)
            if token and str(token).startswith("http"):
                download_url = token
                logger.info(f"[下载] 检测到 V2 下载链接: {download_url[:50]}...")
            else:
                # Use MT_SITE_URL for download link (likely kp.m-team.cc), as api.m-team.io might not handle RSS DL
                download_url = f"{MT_SITE_URL}/api/rss/dl?id={torrent_id}&token={token}"

            logger.info(f"[下载] 成功获取下载链接: {torrent_id}")
            return download_url
        else:
            # 详细记录API错误（不记录完整响应以避免泄露敏感信息）
            error_code = data.get("code")
            error_msg = data.get("message", "未知错误")
            logger.error(f"[下载] API返回错误 - ID={torrent_id}, code={error_code}, message={error_msg}")
            return None
    except Exception as e:
        logger.error(f"[下载] 获取下载链接异常 - ID={torrent_id}, error={type(e).__name__}: {e}")
        return None


async def download_torrent_file(torrent_id: str) -> Optional[bytes]:
    """
    下载 .torrent 文件内容（服务器端下载）

    Args:
        torrent_id: 种子 ID

    Returns:
        Optional[bytes]: .torrent 文件二进制内容，失败返回 None
    """
    # 先获取下载链接
    download_url = await get_torrent_download_url(torrent_id)
    if not download_url:
        return None

    try:
        client = await get_http_client()
        logger.info(f"[下载] 服务器端下载 .torrent 文件: ID={torrent_id}")

        response = await client.get(
            download_url,
            headers={"User-Agent": USER_AGENT},
            follow_redirects=True,
            timeout=30.0
        )

        if response.status_code == 200:
            content = response.content
            # 验证是否为有效的 torrent 文件（应以 d 开头，bencoding 格式）
            if content and len(content) > 0 and content[0:1] == b'd':
                logger.info(f"[下载] 成功下载 .torrent 文件: ID={torrent_id}, 大小={len(content)} bytes")
                return content
            else:
                logger.error(f"[下载] 下载内容不是有效的 .torrent 文件: ID={torrent_id}")
                logger.debug(f"[下载] 响应内容前100字节: {content[:100] if content else 'empty'}")
                return None
        else:
            logger.error(f"[下载] 下载 .torrent 文件失败: ID={torrent_id}, status={response.status_code}")
            return None

    except Exception as e:
        logger.error(f"[下载] 下载 .torrent 文件异常: ID={torrent_id}, error={type(e).__name__}: {e}")
        return None


async def qb_add_torrent_by_url(torrent_url: str, sid: str, tag: str = "") -> bool:
    """
    通过 URL 添加种子到 qBittorrent

    Args:
        torrent_url: 种子下载 URL
        sid: qBittorrent 会话 ID
        tag: 种子标签（可选）

    Returns:
        bool: 添加成功返回 True
    """
    if not sid or not torrent_url:
        return False

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            data = {"urls": torrent_url}
            if tag:
                data["tags"] = tag  # qBittorrent 支持在添加时设置标签

            response = await client.post(
                f"{QBITTORRENT_URL.rstrip('/')}/api/v2/torrents/add",
                data=data,
                cookies={"SID": sid},
            )

            if response.status_code in (401, 403):
                logger.warning("qBittorrent 会话已过期")
                qb_clear_session()
                return False

            # qBittorrent API 返回 "Ok." 表示成功
            if response.status_code == 200:
                logger.info(f"成功添加种子到 qBittorrent (标签: {tag}): {torrent_url[:50]}...")
                return True
            else:
                logger.error(f"添加种子失败: {response.text}")
                return False
    except Exception as e:
        logger.error(f"添加种子异常: {e}")
        return False


async def qb_add_torrent_file(torrent_content: bytes, sid: str, tag: str = "", savepath: str = "") -> bool:
    """
    通过文件内容添加种子到 qBittorrent

    Args:
        torrent_content: 种子文件二进制内容
        sid: qBittorrent 会话 ID
        tag: 种子标签（可选）
        savepath: 下载路径（可选）

    Returns:
        bool: 添加成功返回 True
    """
    if not sid or not torrent_content:
        return False

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Construct multipart/form-data payload
            files = {'torrents': ('meta.torrent', torrent_content, 'application/x-bittorrent')}
            data = {}
            if tag:
                data["tags"] = tag
            if savepath:
                data["savepath"] = savepath

            response = await client.post(
                f"{QBITTORRENT_URL.rstrip('/')}/api/v2/torrents/add",
                data=data,
                files=files,
                cookies={"SID": sid},
            )

            if response.status_code in (401, 403):
                logger.warning("qBittorrent 会话已过期")
                qb_clear_session()
                return False

            if response.status_code == 200:
                logger.info(f"成功通过文件添加种子到 qBittorrent (标签: {tag})")
                return True
            else:
                logger.error(f"添加种子文件失败: {response.text}")
                return False
    except Exception as e:
        logger.error(f"添加种子文件异常: {e}")
        return False


async def qb_get_mteam_stats(sid: str) -> Dict:
    """
    统计 M-Team 相关标签的种子流量

    Args:
        sid: qBittorrent 会话 ID

    Returns:
        Dict: 包含上传下载总量和速率
    """
    torrents = await qb_get_torrents(sid)

    mteam_tags = ['声呐做种', '雷达下载', 'PILOT']
    total_uploaded = 0
    total_downloaded = 0
    upload_speed = 0
    download_speed = 0

    for torrent in torrents:
        tags = torrent.get('tags', '').split(',')
        # 检查是否有 M-Team 标签
        if any(tag.strip() in mteam_tags for tag in tags):
            total_uploaded += torrent.get('uploaded', 0)
            total_downloaded += torrent.get('downloaded', 0)
            upload_speed += torrent.get('upspeed', 0)
            download_speed += torrent.get('dlspeed', 0)

    logger.debug(f"M-Team 标签统计: 上传={total_uploaded}, 下载={total_downloaded}")
    return {
        'uploaded': total_uploaded,
        'downloaded': total_downloaded,
        'upload_speed': upload_speed,
        'download_speed': download_speed
    }
