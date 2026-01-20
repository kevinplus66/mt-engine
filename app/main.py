"""
MT-Engine - M-Team 免费种子猎手
自动搜索当前所有 Free / 2xFree 种子
"""

__version__ = "2.4.1"

import os
import re
import asyncio
import logging
import base64
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Union
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request, Query, HTTPException, Response
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator

# ============ 日志配置 ============
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


# ============ Pydantic Models for Request Validation ============
class DownloadRequest(BaseModel):
    """Request model for torrent download"""
    id: str = Field(..., min_length=1, max_length=20)

    @validator('id')
    def validate_torrent_id(cls, v):
        """Validate torrent ID is numeric only"""
        if not re.match(r'^\d+$', v):
            raise ValueError('Invalid torrent ID format')
        return v


class SearchRequest(BaseModel):
    """Request model for torrent search"""
    keyword: str = Field("", max_length=100)
    mode: str = Field("normal")  # normal/adult/movie/tvshow
    standards: List[int] = Field(default_factory=list)
    videoCodecs: List[int] = Field(default_factory=list)
    audioCodecs: List[int] = Field(default_factory=list)
    sources: List[int] = Field(default_factory=list)  # 新增：来源筛选
    sortField: str = Field("CREATED_DATE")
    sortDirection: str = Field("DESC")
    pageNumber: int = Field(1, ge=1)
    pageSize: int = Field(50, ge=1, le=200)


# ============ Safe Environment Variable Parsing ============
def safe_int(value: str, default: int, min_val: int = 0, max_val: int = 999999999) -> int:
    """Safely parse integer from string with bounds checking"""
    try:
        result = int(value)
        return max(min_val, min(result, max_val))
    except (ValueError, TypeError):
        return default


# ============ 配置 ============
MT_API_BASE = "https://api.m-team.io/api"
MT_SEARCH_URL = f"{MT_API_BASE}/torrent/search"
MT_CATEGORY_URL = f"{MT_API_BASE}/torrent/categoryList"
MT_TOKEN = os.getenv("MT_TOKEN", "")
MT_USER_ID = os.getenv("MT_USER_ID", "")
REFRESH_INTERVAL = safe_int(os.getenv("REFRESH_INTERVAL", "600"), 600, min_val=60, max_val=86400)
MT_SITE_URL = os.getenv("MT_SITE_URL", "https://kp.m-team.cc")
API_DELAY = max(0.5, min(float(os.getenv("API_DELAY", "1") or "1"), 10))  # API请求间隔（秒），限制0.5-10秒

# API URLs
MT_COLLECTION_URL = f"{MT_API_BASE}/torrent/collection"
MT_COLLECTION_LIST_URL = f"{MT_API_BASE}/member/collection"
MT_USER_TORRENT_URL = f"{MT_API_BASE}/member/getUserTorrentList"
MT_PROFILE_URL = f"{MT_API_BASE}/member/profile"

# Rival user ID for comparison (optional)
RIVAL_USER_ID = os.getenv("RIVAL_USER_ID", "")

# PushPlus 微信推送配置
PUSHPLUS_TOKEN = os.getenv("PUSHPLUS_TOKEN", "")
PUSHPLUS_URL = "http://www.pushplus.plus/send"
ALERT_THRESHOLD_MINUTES = 10  # 免费即将到期报警阈值（分钟）
ALERT_COOLDOWN = 1800  # 30分钟内不重复报警同一种子

# qBittorrent 配置
QBITTORRENT_URL = os.getenv("QBITTORRENT_URL", "")
QBITTORRENT_USER = os.getenv("QBITTORRENT_USER", "")
QBITTORRENT_PASSWORD = os.getenv("QBITTORRENT_PASSWORD", "")

# 北京时区 (UTC+8)
BEIJING_TZ = timezone(timedelta(hours=8))

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

# ============ 全局状态 ============
cached_data: Dict[str, Any] = {
    "torrents": [],
    "categories": [],
    "last_update": None,
    "error": None
}

user_torrent_status: Dict[str, Dict] = {
    "seeding": {},
    "leeching": {},
}

user_collection_ids: set = set()

user_profile: Dict[str, Any] = {
    "share_ratio": 0,
    "uploaded": 0,
    "downloaded": 0,
    "uploaded_display": "0 B",
    "downloaded_display": "0 B"
}

rival_profile: Dict[str, Any] = {
    "share_ratio": 0,
    "uploaded": 0,
    "downloaded": 0,
    "uploaded_display": "0 B",
    "downloaded_display": "0 B"
}

# 历史免费种子ID追踪（用于检测"变节"- 免费变收费）
known_free_torrent_ids: set = set()

# 已发送报警记录（防止重复报警）
sent_alerts: Dict[str, float] = {}  # {torrent_id_alerttype: timestamp}

# 自动删除功能状态
auto_delete_enabled: bool = True

# 全局 HTTP 客户端（复用连接池）
http_client: Optional[httpx.AsyncClient] = None

# qBittorrent 会话缓存（避免重复登录导致的问题）
qb_cached_sid: Optional[str] = None
qb_sid_created_at: Optional[float] = None
QB_SESSION_MAX_AGE = 1800  # 会话最大有效期（秒），设为30分钟，比qB的1小时超时更保守

# ============ 模板配置 ============
templates = Jinja2Templates(directory="app/templates")


# ============ HTTP 客户端管理 ============
async def get_http_client() -> httpx.AsyncClient:
    """获取或创建 HTTP 客户端"""
    global http_client
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


# ============ qBittorrent 辅助函数 ============
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
    登录 qBittorrent Web UI（带会话缓存）

    Args:
        force_new: 是否强制重新登录（忽略缓存）

    Returns:
        Optional[str]: 登录成功返回 SID cookie，失败返回 None
    """
    global qb_cached_sid, qb_sid_created_at

    if not QBITTORRENT_URL or not QBITTORRENT_USER or not QBITTORRENT_PASSWORD:
        logger.debug("qBittorrent 配置不完整，跳过登录")
        return None

    # 如果有有效的缓存会话且不是强制重新登录，直接返回
    if not force_new and qb_is_session_valid():
        logger.debug("使用缓存的 qBittorrent 会话")
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


# ============ qBittorrent 标签常量 ============
QB_TAG_PERSONAL = "个人下载"    # Search Engine 下载使用的标签
QB_TAG_FREE_SEED = "免费做种"   # Free Hunter 免费种子使用的标签


# ============ 种子下载功能 ============
async def get_torrent_download_url(torrent_id: str) -> Optional[str]:
    """
    通过 M-Team API 获取种子下载链接

    Args:
        torrent_id: 种子 ID

    Returns:
        Optional[str]: 下载 URL，失败返回 None
    """
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
        data = response.json()

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
            # 详细记录API错误
            error_code = data.get("code")
            error_msg = data.get("message", "未知错误")
            logger.error(f"[下载] API返回错误 - ID={torrent_id}, code={error_code}, message={error_msg}")
            logger.error(f"[下载] 完整响应: {data}")
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


async def qb_add_torrent_file(torrent_content: bytes, sid: str, tag: str = "") -> bool:
    """
    通过文件内容添加种子到 qBittorrent
    
    Args:
        torrent_content: 种子文件二进制内容
        sid: qBittorrent 会话 ID
        tag: 种子标签（可选）

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


# ============ 工具函数 ============
def parse_datetime(dt_string: Optional[str]) -> Optional[datetime]:
    """解析 API 返回的时间字符串"""
    if not dt_string:
        return None

    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%SZ",
    ]

    for fmt in formats:
        try:
            return datetime.strptime(dt_string, fmt)
        except ValueError:
            continue
    return None


def format_size(size_bytes: int) -> str:
    """将字节数转换为人类可读格式"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} PB"


def calculate_remaining_time(end_time: Optional[datetime]) -> Dict[str, Any]:
    """计算免费剩余时间"""
    if end_time is None:
        return {
            "display": "永久免费",
            "display_en": "Permanent",
            "status": "permanent",
            "color": "green",
            "hours": float('inf'),
            "timestamp": None
        }

    now = datetime.now(BEIJING_TZ).replace(tzinfo=None)
    total_seconds = (end_time - now).total_seconds()

    if total_seconds <= 0:
        return {
            "display": "已过期",
            "display_en": "Expired",
            "status": "expired",
            "color": "red",
            "hours": 0,
            "timestamp": end_time.isoformat()
        }

    hours = int(total_seconds // 3600)
    minutes = int((total_seconds % 3600) // 60)
    total_hours = hours + minutes / 60

    # 格式化显示
    if hours >= 24:
        days, remaining_hours = divmod(hours, 24)
        display = f"{days}天 {remaining_hours}小时"
        display_en = f"{days}d {remaining_hours}h"
    else:
        display = f"{hours}小时 {minutes}分"
        display_en = f"{hours}h {minutes}m"

    # 确定状态和颜色
    if total_hours >= 6:
        color, status = "green", "safe"
    elif total_hours >= 2:
        color, status = "yellow", "warning"
    elif total_hours >= 1:
        color, status = "orange", "danger"
    else:
        color, status = "red", "critical"

    return {
        "display": display,
        "display_en": display_en,
        "status": status,
        "color": color,
        "hours": total_hours,
        "timestamp": end_time.isoformat()
    }


def get_discount_label(discount: Optional[str]) -> Dict[str, str]:
    """获取优惠标签"""
    labels = {
        "FREE": {"zh": "免费", "en": "Free"},
        "_2X_FREE": {"zh": "2x免费", "en": "2x Free"},
        "PERCENT_50": {"zh": "50%", "en": "50%"},
        "_2X_PERCENT_50": {"zh": "2x50%", "en": "2x50%"},
        "_2X": {"zh": "2x上传", "en": "2x UP"},
        "PERCENT_30": {"zh": "30%", "en": "30%"},
        "PERCENT_70": {"zh": "70%", "en": "70%"},
        "NORMAL": {"zh": "无优惠", "en": "None"}
    }
    return labels.get(discount, {"zh": discount or "未知", "en": discount or "Unknown"})


# ============ API 请求函数 ============
async def fetch_categories() -> List[Dict]:
    """获取种子类别列表"""
    if not MT_TOKEN:
        return []

    try:
        client = await get_http_client()
        response = await client.post(MT_CATEGORY_URL, headers=get_headers())
        data = response.json()
        if data.get("code") == "0":
            return data.get("data", [])
    except Exception as e:
        logger.error(f"获取类别失败: {e}")
    return []


async def search_free_torrents(
    discount_type: str = "FREE",
    mode: str = "normal",
    page: int = 1,
    page_size: int = 200
) -> List[Dict]:
    """搜索免费种子"""
    if not MT_TOKEN:
        return []

    payload = {
        "mode": mode,
        "discount": discount_type,
        "pageNumber": page,
        "pageSize": page_size
    }

    try:
        client = await get_http_client()
        response = await client.post(MT_SEARCH_URL, headers=get_headers(), json=payload)
        data = response.json()

        if data.get("code") == "0":
            return data.get("data", {}).get("data", [])
        else:
            logger.error(f"搜索 {discount_type} (mode={mode}) 失败: {data.get('message')}")
    except Exception as e:
        logger.error(f"搜索 {discount_type} (mode={mode}) 异常: {e}")

    return []


async def fetch_user_torrent_status() -> None:
    """获取用户的做种和下载中的种子状态"""
    global user_torrent_status

    if not MT_TOKEN or not MT_USER_ID:
        return

    try:
        userid = int(MT_USER_ID)
        client = await get_http_client()

        # 获取做种中的种子
        seeding_payload = {"userid": userid, "type": "SEEDING", "pageNumber": 1, "pageSize": 200}
        seeding_response = await client.post(MT_USER_TORRENT_URL, headers=get_headers(), json=seeding_payload)
        seeding_data = seeding_response.json()

        if seeding_data.get("code") == "0":
            seeding_list = seeding_data.get("data", {}).get("data", [])
            user_torrent_status["seeding"] = {
                str(item.get("torrent", {}).get("id", item.get("id", ""))): item
                for item in seeding_list
            }
            logger.info(f"获取到 {len(user_torrent_status['seeding'])} 个做种中种子")

        # 增加延迟避免 API 速率限制
        await asyncio.sleep(max(API_DELAY, 2))

        # 获取下载中的种子
        leeching_payload = {"userid": userid, "type": "LEECHING", "pageNumber": 1, "pageSize": 200}
        leeching_response = await client.post(MT_USER_TORRENT_URL, headers=get_headers(), json=leeching_payload)
        leeching_data = leeching_response.json()
        logger.debug(f"LEECHING API 响应: code={leeching_data.get('code')}, data keys={list(leeching_data.get('data', {}).keys()) if isinstance(leeching_data.get('data'), dict) else type(leeching_data.get('data'))}")

        if leeching_data.get("code") == "0":
            leeching_list = leeching_data.get("data", {}).get("data", [])
            user_torrent_status["leeching"] = {
                str(item.get("torrent", {}).get("id", item.get("id", ""))): item
                for item in leeching_list
            }
            logger.info(f"获取到 {len(user_torrent_status['leeching'])} 个下载中种子")
        else:
            logger.warning(f"获取下载中种子失败: code={leeching_data.get('code')}, message={leeching_data.get('message')}")

    except Exception as e:
        logger.error(f"获取用户种子状态失败: {e}")


async def fetch_user_collection() -> None:
    """获取用户收藏列表"""
    global user_collection_ids

    if not MT_TOKEN:
        return

    try:
        client = await get_http_client()
        payload = {"pageNumber": 1, "pageSize": 200}
        response = await client.post(MT_COLLECTION_LIST_URL, headers=get_headers(), json=payload)
        data = response.json()

        if data.get("code") == "0":
            collection_list = data.get("data", {}).get("data", [])
            user_collection_ids = set()
            for item in collection_list:
                if isinstance(item, dict):
                    torrent_id = str(item.get("torrent", {}).get("id", item.get("id", "")))
                else:
                    torrent_id = str(item)
                if torrent_id:
                    user_collection_ids.add(torrent_id)
            logger.info(f"获取到 {len(user_collection_ids)} 个收藏种子")

    except Exception as e:
        logger.error(f"获取收藏列表失败: {e}")


async def fetch_user_profile() -> None:
    """获取用户资料（分享率、上传、下载）"""
    global user_profile

    if not MT_TOKEN:
        return

    if not MT_USER_ID:
        logger.warning("未配置 MT_USER_ID，无法获取用户资料")
        return

    try:
        profile_data = await _fetch_profile_by_uid(MT_USER_ID)
        if profile_data:
            user_profile = profile_data
            logger.debug(f"获取用户资料: 分享率={profile_data['share_ratio']:.2f}")

    except Exception as e:
        logger.error(f"获取用户资料失败: {e}")


async def fetch_rival_profile() -> None:
    """获取对手用户资料（分享率）"""
    global rival_profile

    if not MT_TOKEN:
        return

    if not RIVAL_USER_ID:
        logger.info("未配置 RIVAL_USER_ID，跳过获取对手资料")
        return

    try:
        profile_data = await _fetch_profile_by_uid(RIVAL_USER_ID)
        if profile_data:
            rival_profile = profile_data
            logger.debug(f"获取对手资料: 分享率={profile_data['share_ratio']:.2f}")

    except Exception as e:
        logger.error(f"获取对手资料失败: {e}")


async def _fetch_profile_by_uid(uid: str) -> Optional[Dict[str, Any]]:
    """通用函数：根据用户ID获取资料"""
    try:
        client = await get_http_client()

        headers = {
            "User-Agent": USER_AGENT,
            "x-api-key": MT_TOKEN.strip(),
            "Accept": "application/json",
        }
        form_data = {"uid": str(uid)}
        response = await client.post(MT_PROFILE_URL, headers=headers, data=form_data)
        data = response.json()

        logger.debug(f"Profile API 响应 (uid={uid}): code={data.get('code')}")

        if data.get("code") == "0":
            member_data = data.get("data", {})

            # 尝试多种数据结构路径
            member_count = member_data.get("memberCount", {})

            # 尝试从 memberCount 获取
            uploaded = _safe_int(member_count.get("uploaded", 0))
            downloaded = _safe_int(member_count.get("downloaded", 0))
            share_ratio_from_api = member_count.get("shareRate")

            # 如果 memberCount 没有数据，尝试从 member_data 直接获取
            if uploaded == 0 and downloaded == 0:
                uploaded = _safe_int(member_data.get("uploaded", 0))
                downloaded = _safe_int(member_data.get("downloaded", 0))
                if share_ratio_from_api is None:
                    share_ratio_from_api = member_data.get("shareRate")

            # 如果还没有，尝试从 member 字段获取
            if uploaded == 0 and downloaded == 0:
                member = member_data.get("member", {})
                uploaded = _safe_int(member.get("uploaded", 0))
                downloaded = _safe_int(member.get("downloaded", 0))
                if share_ratio_from_api is None:
                    share_ratio_from_api = member.get("shareRate")

            # 使用 API 返回的分享率，或者自己计算
            if share_ratio_from_api is not None:
                try:
                    share_ratio = float(share_ratio_from_api)
                except (ValueError, TypeError):
                    share_ratio = 0.0
            elif downloaded > 0:
                share_ratio = uploaded / downloaded
            else:
                share_ratio = 99999.99 if uploaded > 0 else 0.0

            return {
                "share_ratio": share_ratio,
                "uploaded": uploaded,
                "downloaded": downloaded,
                "uploaded_display": format_size(uploaded),
                "downloaded_display": format_size(downloaded)
            }
        else:
            logger.warning(f"获取用户资料失败 (uid={uid}): {data.get('message')}")
            return None

    except Exception as e:
        logger.error(f"获取用户资料异常 (uid={uid}): {e}")
        return None


def _safe_int(value: Any) -> int:
    """Safely convert value to int"""
    try:
        return int(value or 0)
    except (ValueError, TypeError):
        return 0


# ============ PushPlus 推送功能 ============
async def send_pushplus_alert(title: str, content: str) -> bool:
    """
    发送 PushPlus 微信推送通知

    Args:
        title: 通知标题
        content: 通知内容（支持HTML格式）

    Returns:
        bool: 是否发送成功
    """
    if not PUSHPLUS_TOKEN:
        logger.warning("未配置 PUSHPLUS_TOKEN，跳过推送")
        return False

    try:
        client = await get_http_client()
        payload = {
            "token": PUSHPLUS_TOKEN,
            "title": title,
            "content": content,
            "template": "html"
        }

        response = await client.post(
            PUSHPLUS_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10.0
        )
        result = response.json()

        if result.get("code") == 200:
            logger.info(f"PushPlus 推送成功: {title}")
            return True
        else:
            logger.error(f"PushPlus 推送失败: {result.get('msg', '未知错误')}")
            return False

    except Exception as e:
        logger.error(f"PushPlus 推送异常: {e}")
        return False


def can_send_alert(torrent_id: str, alert_type: str) -> bool:
    """
    检查是否可以发送报警（防止重复报警）

    Args:
        torrent_id: 种子ID
        alert_type: 报警类型 ('expiring' 或 'changed')

    Returns:
        bool: 是否可以发送
    """
    global sent_alerts

    alert_key = f"{torrent_id}_{alert_type}"
    now = datetime.now().timestamp()

    # 清理过期的报警记录
    expired_keys = [k for k, v in sent_alerts.items() if now - v > ALERT_COOLDOWN]
    for k in expired_keys:
        del sent_alerts[k]

    # 检查是否在冷却期内
    if alert_key in sent_alerts:
        return False

    # 记录本次报警
    sent_alerts[alert_key] = now
    return True


def is_free_discount(discount: Optional[str]) -> bool:
    """检查是否为免费优惠类型"""
    if not discount:
        return False
    return "FREE" in discount.upper()


async def check_emergency_alerts(torrents: List[Dict]) -> None:
    """
    检查紧急情况并执行自动删除/发送报警

    情况 A：免费即将到期且未下载完（剩余时间 < 10 分钟）
    情况 B：免费突然失效且未下载完（变节检测）

    注意：自动删除功能独立于 PushPlus，即使未配置 PUSHPLUS_TOKEN 也会执行删除
    """
    global known_free_torrent_ids

    # 如果既没有启用自动删除，也没有配置推送，则跳过
    if not auto_delete_enabled and not PUSHPLUS_TOKEN:
        # 仍然需要更新历史免费记录（用于变节检测）
        for torrent in torrents:
            if is_free_discount(torrent.get("discount")):
                known_free_torrent_ids.add(torrent["id"])
        return

    alerts_to_send = []

    # 第一步：更新历史免费记录
    for torrent in torrents:
        if is_free_discount(torrent.get("discount")):
            known_free_torrent_ids.add(torrent["id"])

    logger.debug(f"当前追踪的免费种子数量: {len(known_free_torrent_ids)}")

    # 第二步：检查下载中的种子是否有紧急情况
    for torrent_id, leeching_info in user_torrent_status.get("leeching", {}).items():
        # 获取下载进度
        try:
            peer_info = leeching_info.get("peer", {})
            torrent_data = leeching_info.get("torrent", {})
            downloaded = int(peer_info.get("downloaded", 0) or 0)
            total_size = int(torrent_data.get("size", 0) or 0)

            if total_size > 0:
                progress = min((downloaded / total_size) * 100, 100.0)
            else:
                progress = 0

            # 已完成下载的不需要报警
            if progress >= 100:
                continue

            torrent_name = torrent_data.get("name", "未知种子")
            status_info = torrent_data.get("status", {})
            current_discount = status_info.get("discount", "")
            discount_end_time_str = status_info.get("discountEndTime")

        except (ValueError, TypeError, KeyError) as e:
            logger.debug(f"解析种子 {torrent_id} 信息失败: {e}")
            continue

        # 情况 A：免费即将到期且未下载完（剩余时间 < 10 分钟时自动删除）
        if is_free_discount(current_discount) and discount_end_time_str:
            discount_end_time = parse_datetime(discount_end_time_str)
            if discount_end_time:
                remaining = calculate_remaining_time(discount_end_time)
                remaining_minutes = remaining["hours"] * 60

                if remaining_minutes < ALERT_THRESHOLD_MINUTES and remaining_minutes > 0:
                    if can_send_alert(torrent_id, "expiring"):
                        # 初始化状态变量
                        deleted_successfully = False
                        torrent_found = False
                        login_success = False

                        # 如果启用自动删除功能，尝试从 qBittorrent 删除该种子
                        if auto_delete_enabled and QBITTORRENT_URL:
                            logger.info(f"自动删除功能已启用（免费即将到期），尝试删除种子 {torrent_id} ({torrent_name[:50]}...)")
                            sid = await qb_login()
                            if sid:
                                login_success = True
                                torrent_hash = await qb_find_torrent_by_mteam_id(torrent_id, sid)
                                if torrent_hash:
                                    torrent_found = True
                                    deleted_successfully = await qb_delete_torrent(torrent_hash, sid, delete_files=True)
                                    if deleted_successfully:
                                        logger.info(f"成功自动删除种子 {torrent_id}（免费即将到期）")
                                    else:
                                        logger.warning(f"自动删除种子 {torrent_id} 失败（免费即将到期）")
                                else:
                                    logger.info(f"未在 qBittorrent 中找到种子 {torrent_id}，无需删除")
                            else:
                                logger.warning("qBittorrent 登录失败，无法执行自动删除")

                        # 生成简化的删除状态消息
                        if deleted_successfully:
                            deletion_message = "🗑️ <span style='color:green;'><b>已触发自动删除，安全下车。</b></span>"
                        elif not auto_delete_enabled:
                            deletion_message = "⚠️ <span style='color:orange;'>自动删除未开启，建议立即手动检查！</span>"
                        elif not login_success:
                            deletion_message = "🚫 <span style='color:red;'>客户端登录失败，无法执行删除。</span>"
                        elif not torrent_found:
                            deletion_message = "❓ <span style='color:gray;'>未在客户端找到该种子。</span>"
                        else:
                            deletion_message = "⚠️ <span style='color:red;'><b>自动删除失败，请务必手动处理！</b></span>"

                        # 简化的告警模板
                        alerts_to_send.append({
                            "type": "expiring",
                            "title": "MT免费即将结束",
                            "content": (
                                f"<h3>⚠️ 免费即将结束 ({remaining['display']})</h3>"
                                f"<p><b>{torrent_name}</b></p>"
                                f"📉 进度: <b style='color:orange;'>{progress:.1f}%</b><br>"
                                f"⏱️ 剩余: <b style='color:red;'>{remaining['display']}</b><br>"
                                f"🏷️ 优惠: {current_discount}<br>"
                                f"<hr>"
                                f"{deletion_message}"
                            )
                        })

        # 情况 B：免费突然失效（变节检测）
        if not is_free_discount(current_discount) and torrent_id in known_free_torrent_ids:
            if can_send_alert(torrent_id, "changed"):
                # 初始化状态变量
                deleted_successfully = False
                torrent_found = False
                login_success = False

                # 如果启用自动删除功能，尝试从 qBittorrent 删除该种子
                if auto_delete_enabled and QBITTORRENT_URL:
                    logger.info(f"自动删除功能已启用（免费变收费），尝试删除种子 {torrent_id} ({torrent_name[:50]}...)")
                    sid = await qb_login()
                    if sid:
                        login_success = True
                        torrent_hash = await qb_find_torrent_by_mteam_id(torrent_id, sid)
                        if torrent_hash:
                            torrent_found = True
                            deleted_successfully = await qb_delete_torrent(torrent_hash, sid, delete_files=True)
                            if deleted_successfully:
                                logger.info(f"成功自动删除种子 {torrent_id}（免费变收费）")
                            else:
                                logger.warning(f"自动删除种子 {torrent_id} 失败（免费变收费）")
                        else:
                            logger.info(f"未在 qBittorrent 中找到种子 {torrent_id}，无需删除")
                    else:
                        logger.warning("qBittorrent 登录失败，无法执行自动删除")

                # 生成简化的删除状态消息
                if deleted_successfully:
                    deletion_message = "🗑️ <span style='color:green;'><b>已触发自动删除，安全下车。</b></span>"
                elif not auto_delete_enabled:
                    deletion_message = "⚠️ <span style='color:orange;'>自动删除未开启，建议立即手动检查！</span>"
                elif not login_success:
                    deletion_message = "🚫 <span style='color:red;'>客户端登录失败，无法执行删除。</span>"
                elif not torrent_found:
                    deletion_message = "❓ <span style='color:gray;'>未在客户端找到该种子。</span>"
                else:
                    deletion_message = "⚠️ <span style='color:red;'><b>自动删除失败，请务必手动处理！</b></span>"

                # 简化的告警模板
                alerts_to_send.append({
                    "type": "changed",
                    "title": "MT免费优惠已失效",
                    "content": (
                        f"<h3>🚨 免费优惠已失效</h3>"
                        f"<p><b>{torrent_name}</b></p>"
                        f"📉 进度: <b style='color:orange;'>{progress:.1f}%</b><br>"
                        f"❌ 状态: <b style='color:red;'>{current_discount or 'NORMAL'}</b><br>"
                        f"<hr>"
                        f"{deletion_message}"
                    )
                })

    # 发送报警（仅当配置了 PUSHPLUS_TOKEN）
    if PUSHPLUS_TOKEN:
        for alert in alerts_to_send:
            await send_pushplus_alert(alert["title"], alert["content"])
            await asyncio.sleep(1)  # 避免推送太快


async def toggle_collection(torrent_id: str, make: bool) -> Dict[str, Any]:
    """切换种子收藏状态"""
    if not MT_TOKEN:
        return {"success": False, "message": "未配置 MT_TOKEN"}

    try:
        client = await get_http_client()
        headers = {
            "User-Agent": USER_AGENT,
            "x-api-key": MT_TOKEN.strip(),
            "Accept": "application/json",
        }
        form_data = {"id": torrent_id, "make": "true" if make else "false"}
        response = await client.post(MT_COLLECTION_URL, headers=headers, data=form_data)
        data = response.json()

        if data.get("code") == "0":
            action = "收藏" if make else "取消收藏"
            logger.info(f"{action}种子 {torrent_id} 成功")
            return {"success": True, "message": f"{action}成功", "collected": make}
        else:
            return {"success": False, "message": data.get("message", "操作失败")}

    except Exception as e:
        logger.error(f"收藏操作失败: {e}")
        return {"success": False, "message": str(e)}


# ============ 数据处理 ============
def process_torrent(item: Dict, discount_type: str, torrent_mode: str = "normal") -> Dict:
    """处理单个种子数据"""
    torrent_info = item if "id" in item else item.get("torrent", item)
    status_info = torrent_info.get("status") or {}

    torrent_id = str(torrent_info.get("id", ""))
    name = torrent_info.get("name", "未知")
    small_descr = torrent_info.get("smallDescr", "")
    size = _safe_int(torrent_info.get("size"))

    seeders = _safe_int(status_info.get("seeders"))
    leechers = _safe_int(status_info.get("leechers"))

    discount = status_info.get("discount", discount_type)
    discount_end_time = parse_datetime(status_info.get("discountEndTime"))
    remaining = calculate_remaining_time(discount_end_time)

    detail_url = f"{MT_SITE_URL}/detail/{torrent_id}"

    # 用户状态
    user_status = "none"
    user_progress = 0

    if torrent_id in user_torrent_status["seeding"]:
        user_status = "seeding"
    elif torrent_id in user_torrent_status["leeching"]:
        user_status = "leeching"
        leeching_info = user_torrent_status["leeching"][torrent_id]
        try:
            peer_info = leeching_info.get("peer", {})
            torrent_data = leeching_info.get("torrent", {})
            downloaded = int(peer_info.get("downloaded", 0) or 0)
            total_size = int(torrent_data.get("size", 0) or 0)
            if total_size > 0 and downloaded > 0:
                user_progress = min((downloaded / total_size) * 100, 100.0)
        except (ValueError, TypeError, KeyError):
            user_progress = 0

    return {
        "id": torrent_id,
        "name": name,
        "small_descr": small_descr,
        "size": size,
        "size_display": format_size(size),
        "seeders": seeders,
        "leechers": leechers,
        "discount": discount,
        "discount_label": get_discount_label(discount),
        "discount_end_time": status_info.get("discountEndTime"),
        "remaining": remaining,
        "category": torrent_info.get("category", ""),
        "category_name": torrent_info.get("categoryName", ""),
        "created_date": torrent_info.get("createdDate", ""),
        "detail_url": detail_url,
        "user_status": user_status,
        "user_progress": user_progress,
        "is_collected": torrent_id in user_collection_ids,
        "mode": torrent_mode
    }


async def fetch_all_free_torrents() -> Dict[str, Any]:
    """获取所有免费种子"""
    global cached_data

    if not MT_TOKEN:
        cached_data["error"] = "未配置 MT_TOKEN 环境变量"
        return cached_data

    logger.info("开始搜索免费种子")

    # 获取用户状态
    await fetch_user_torrent_status()
    await asyncio.sleep(API_DELAY)
    await fetch_user_collection()
    await asyncio.sleep(API_DELAY)
    await fetch_user_profile()
    await asyncio.sleep(API_DELAY)
    await fetch_rival_profile()

    all_torrents = []
    seen_ids = set()

    # 并行搜索普通区和成人区
    search_tasks = [
        ("FREE", "normal"),
        ("_2X_FREE", "normal"),
        ("FREE", "adult"),
        ("_2X_FREE", "adult"),
    ]

    for discount_type, mode in search_tasks:
        await asyncio.sleep(API_DELAY)
        torrents = await search_free_torrents(discount_type, mode=mode)
        for item in torrents:
            torrent = process_torrent(item, discount_type, mode)
            if torrent["id"] not in seen_ids:
                seen_ids.add(torrent["id"])
                all_torrents.append(torrent)

    # 按剩余时间排序
    all_torrents.sort(key=lambda t: t["remaining"]["hours"])

    # 获取类别列表
    categories = await fetch_categories()

    # 统计
    free_count = sum(1 for t in all_torrents if t["discount"] == "FREE")
    free_2x_count = sum(1 for t in all_torrents if t["discount"] == "_2X_FREE")

    cached_data = {
        "torrents": all_torrents,
        "categories": categories,
        "last_update": datetime.now(BEIJING_TZ).strftime("%Y-%m-%d %H:%M:%S"),
        "error": None,
        "total": len(all_torrents),
        "free_count": free_count,
        "free_2x_count": free_2x_count
    }

    logger.info(f"找到 {len(all_torrents)} 个免费种子 (Free: {free_count}, 2xFree: {free_2x_count})")

    # 检查紧急情况（免费即将到期/免费变收费）并执行自动删除
    # 注意：即使未配置 PUSHPLUS_TOKEN，自动删除功能也会正常工作
    await check_emergency_alerts(all_torrents)

    return cached_data


async def background_refresh():
    """后台定时刷新任务"""
    while True:
        start_time = asyncio.get_event_loop().time()
        await fetch_all_free_torrents()
        elapsed = asyncio.get_event_loop().time() - start_time
        sleep_time = max(60, REFRESH_INTERVAL - elapsed)  # 至少等待60秒
        logger.info(f"数据刷新完成，耗时 {elapsed:.1f}秒，下次刷新在 {sleep_time:.0f}秒后")
        await asyncio.sleep(sleep_time)


async def fetch_country_list() -> Dict[int, str]:
    """获取国家列表并返回ID到名称的映射"""
    if not MT_TOKEN:
        return {}

    try:
        client = await get_http_client()
        response = await client.post(
            f"{MT_API_BASE}/system/countryList",
            headers={"x-api-key": MT_TOKEN},
            timeout=10
        )
        result = response.json()

        # M-Team API返回code可能是0, "0", 或"SUCCESS"
        code = result.get("code")
        if code in (0, "0", "SUCCESS"):
            countries = {}
            for country in result.get("data", []):
                countries[int(country["id"])] = country.get("name", "")
            logger.info(f"成功获取 {len(countries)} 个国家")
            return countries
        else:
            logger.error(f"获取国家列表失败: code={code}, message={result.get('message')}")
            return {}
    except Exception as e:
        logger.error(f"获取国家列表异常: {e}")
        return {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    global http_client, COUNTRY_LABELS
    http_client = httpx.AsyncClient(timeout=30.0)

    # 加载国家列表
    COUNTRY_LABELS = await fetch_country_list()
    logger.info(f"已加载 {len(COUNTRY_LABELS)} 个国家映射")

    await fetch_all_free_torrents()
    task = asyncio.create_task(background_refresh())

    yield

    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    if http_client:
        await http_client.aclose()


# ============ FastAPI 应用 ============
app = FastAPI(
    title="MT-Engine",
    description="M-Team 免费种子猎手",
    version="2.4.1",
    lifespan=lifespan,
    docs_url=None,  # Disable Swagger UI in production
    redoc_url=None  # Disable ReDoc in production
)


# ============ Security Middleware ============
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses"""
    response = await call_next(request)
    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"
    # Prevent MIME sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    # XSS Protection
    response.headers["X-XSS-Protection"] = "1; mode=block"
    # Referrer Policy
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Content Security Policy
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "font-src 'self'; "
        "connect-src 'self'; "
        "frame-ancestors 'none';"
    )
    return response


# ============ Rate Limiting (Simple In-Memory) ============
rate_limit_store: Dict[str, List[float]] = {}
RATE_LIMIT_REQUESTS = 30  # requests
RATE_LIMIT_WINDOW = 60  # seconds


def check_rate_limit(client_ip: str) -> bool:
    """Check if client has exceeded rate limit. Returns True if allowed."""
    now = datetime.now().timestamp()
    if client_ip not in rate_limit_store:
        rate_limit_store[client_ip] = []

    # Remove old entries
    rate_limit_store[client_ip] = [
        ts for ts in rate_limit_store[client_ip]
        if now - ts < RATE_LIMIT_WINDOW
    ]

    if len(rate_limit_store[client_ip]) >= RATE_LIMIT_REQUESTS:
        return False

    rate_limit_store[client_ip].append(now)
    return True

# 静态文件（如果存在）
try:
    app.mount("/static", StaticFiles(directory="app/static"), name="static")
except Exception:
    pass


# ============ 搜索引擎筛选选项 ============
# 使用 M-Team API 实际返回的 ID（已验证）
FILTER_OPTIONS = {
    "standards": [
        {"id": 7, "name": "8K"},
        {"id": 6, "name": "4K"},
        {"id": 1, "name": "1080p"},
        {"id": 2, "name": "1080i"},
        {"id": 3, "name": "720p"},
        {"id": 5, "name": "SD"}
    ],
    "videoCodecs": [
        {"id": 1, "name": "H.264/AVC"},
        {"id": 16, "name": "H.265/HEVC"},
        {"id": 19, "name": "AV1"},
        {"id": 2, "name": "VC-1"},
        {"id": 4, "name": "MPEG-2"}
    ],
    "audioCodecs": [
        {"id": 10, "name": "TrueHD Atmos"},
        {"id": 11, "name": "DTS-HD MA"},
        {"id": 9, "name": "TrueHD"},
        {"id": 3, "name": "DTS"},
        {"id": 1, "name": "FLAC"}
    ],
    "sources": [
        {"id": 8, "name": "Web-DL"},
        {"id": 1, "name": "Bluray"},
        {"id": 4, "name": "Remux"},
        {"id": 5, "name": "HDTV"},
        {"id": 3, "name": "DVD"}
    ],
    "modes": [
        {"id": "normal", "name_zh": "综合", "name_en": "All"},
        {"id": "movie", "name_zh": "电影", "name_en": "Movie"},
        {"id": "tvshow", "name_zh": "电视剧", "name_en": "TV Show"},
        {"id": "adult", "name_zh": "成人", "name_en": "Adult"}
    ]
}

# ============ 质量标签映射 ============
# 用于将 ID 转换为显示名称
QUALITY_LABELS = {
    "standards": {7: "8K", 6: "4K", 1: "1080p", 2: "1080i", 3: "720p", 5: "SD"},
    "videoCodecs": {1: "H.264", 16: "H.265", 19: "AV1", 2: "VC-1", 4: "MPEG-2"},
    "audioCodecs": {10: "Atmos", 11: "DTS-HD MA", 9: "TrueHD", 3: "DTS", 1: "FLAC"},
    "sources": {8: "WEB-DL", 1: "Bluray", 4: "Remux", 5: "HDTV", 3: "DVD"}
}

# 国家映射（ID到名称）
COUNTRY_LABELS = {}


@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    """主仪表盘页面"""
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "data": cached_data,
            "refresh_interval": REFRESH_INTERVAL,
            "site_url": MT_SITE_URL,
            "user_profile": user_profile,
            "rival_profile": rival_profile
        }
    )


@app.get("/search", response_class=HTMLResponse)
async def search_page(request: Request):
    """搜索引擎页面"""
    return templates.TemplateResponse(
        "search.html",
        {
            "request": request,
            "site_url": MT_SITE_URL,
            "user_profile": user_profile,
            "rival_profile": rival_profile,
            "filter_options": FILTER_OPTIONS
        }
    )


@app.get("/api/torrents")
async def api_torrents(
    discount: Optional[str] = Query(None, description="筛选优惠类型: FREE, _2X_FREE"),
    min_size: Optional[int] = Query(None, description="最小大小(字节)"),
    max_size: Optional[int] = Query(None, description="最大大小(字节)"),
    category: Optional[str] = Query(None, description="类别ID"),
    mode: Optional[str] = Query(None, description="频道: normal, adult")
):
    """API 接口返回 JSON 数据，支持筛选"""
    torrents = cached_data.get("torrents", [])

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
        **cached_data,
        "torrents": torrents,
        "filtered_count": len(torrents)
    }


@app.post("/api/refresh")
async def api_refresh(request: Request):
    """手动触发刷新"""
    # Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait.")

    await fetch_all_free_torrents()
    return {"status": "ok", "message": "刷新完成"}


@app.post("/api/download")
async def api_download_torrent(request: Request, data: DownloadRequest):
    """从 Free Hunter 下载种子到 qBittorrent (标签: 免费做种)"""
    # Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
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


@app.post("/api/auto-delete/toggle")
async def api_auto_delete_toggle(request: Request):
    """切换自动删除功能"""
    global auto_delete_enabled

    # Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait.")

    # Toggle the state
    auto_delete_enabled = not auto_delete_enabled

    logger.info(f"自动删除功能已{'启用' if auto_delete_enabled else '禁用'}")

    return {
        "success": True,
        "enabled": auto_delete_enabled,
        "message": f"自动删除已{'启用' if auto_delete_enabled else '禁用'}"
    }


@app.get("/api/auto-delete/status")
async def api_auto_delete_status():
    """获取自动删除功能状态"""
    return {
        "enabled": auto_delete_enabled,
        "qbittorrent_configured": bool(QBITTORRENT_URL and QBITTORRENT_USER and QBITTORRENT_PASSWORD)
    }


@app.get("/api/categories")
async def api_categories():
    """获取类别列表"""
    return {"categories": cached_data.get("categories", [])}


@app.get("/api/filter-options")
async def api_filter_options():
    """获取搜索筛选选项"""
    return FILTER_OPTIONS


@app.post("/api/search")
async def api_search(request: Request, data: SearchRequest):
    """搜索种子"""
    # Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests")

    if not MT_TOKEN:
        return {"success": False, "message": "未配置 MT_TOKEN", "data": [], "total": 0}

    try:
        client = await get_http_client()

        # 构建搜索请求
        payload = {
            "mode": data.mode,
            "pageNumber": data.pageNumber,
            "pageSize": data.pageSize,
        }

        # 添加关键词
        if data.keyword:
            payload["keyword"] = data.keyword

        # 添加筛选条件
        if data.standards:
            payload["standards"] = data.standards
        if data.videoCodecs:
            payload["videoCodecs"] = data.videoCodecs
        if data.audioCodecs:
            payload["audioCodecs"] = data.audioCodecs
        if data.sources:
            payload["sources"] = data.sources

        # 排序
        payload["sortField"] = data.sortField
        payload["sortDirection"] = data.sortDirection

        response = await client.post(MT_SEARCH_URL, headers=get_headers(), json=payload)
        result = response.json()

        if result.get("code") == "0":
            raw_data = result.get("data", {}).get("data", [])
            total = result.get("data", {}).get("total", 0)

            # 处理每个种子数据
            torrents = []
            for item in raw_data:
                torrent_info = item if "id" in item else item.get("torrent", item)
                status_info = torrent_info.get("status") or {}

                torrent_id = str(torrent_info.get("id", ""))
                name = torrent_info.get("name", "未知")
                small_descr = torrent_info.get("smallDescr", "")
                size = _safe_int(torrent_info.get("size"))

                seeders = _safe_int(status_info.get("seeders"))
                leechers = _safe_int(status_info.get("leechers"))

                discount = status_info.get("discount", "")
                discount_end_time = status_info.get("discountEndTime")

                created_date = torrent_info.get("createdDate", "")

                # 提取质量元数据
                team_name = torrent_info.get("teamName", "")
                standard_id = _safe_int(torrent_info.get("standard"))
                video_codec_id = _safe_int(torrent_info.get("videoCodec"))
                audio_codec_id = _safe_int(torrent_info.get("audioCodec"))
                source_id = _safe_int(torrent_info.get("source"))
                times_completed = int(status_info.get("timesCompleted", 0))
                tags = torrent_info.get("tags", "")

                # 新字段
                labels_new = torrent_info.get("labelsNew", [])
                imdb = torrent_info.get("imdb", "")
                douban = torrent_info.get("douban", "")
                countries = torrent_info.get("countries", "")

                # 处理国家字段（ID转名称）
                country_name = ""
                if countries:
                    # countries 可能是: 单个ID字符串 "1", 逗号分隔 "1,2,3", 整数, 或数组
                    if isinstance(countries, str):
                        # 处理逗号分隔的字符串 "1,2,3"
                        country_ids = [cid.strip() for cid in countries.split(",") if cid.strip().isdigit()]
                        country_names = [COUNTRY_LABELS.get(int(cid), "") for cid in country_ids]
                        country_name = ", ".join(filter(None, country_names))
                    elif isinstance(countries, int):
                        country_name = COUNTRY_LABELS.get(countries, "")
                    elif isinstance(countries, list):
                        country_names = [COUNTRY_LABELS.get(int(cid), "") for cid in countries if str(cid).isdigit()]
                        country_name = ", ".join(filter(None, country_names))

                detail_url = f"{MT_SITE_URL}/detail/{torrent_id}"

                # 用户状态
                user_status = "none"
                if torrent_id in user_torrent_status["seeding"]:
                    user_status = "seeding"
                elif torrent_id in user_torrent_status["leeching"]:
                    user_status = "leeching"

                torrents.append({
                    "id": torrent_id,
                    "name": name,
                    "small_descr": small_descr,
                    "size": size,
                    "size_display": format_size(size),
                    "seeders": seeders,
                    "leechers": leechers,
                    "discount": discount,
                    "discount_label": get_discount_label(discount),
                    "discount_end_time": discount_end_time,
                    "created_date": created_date,
                    "detail_url": detail_url,
                    "user_status": user_status,
                    "quality_metadata": {
                        "standard": QUALITY_LABELS["standards"].get(standard_id, ""),
                        "video_codec": QUALITY_LABELS["videoCodecs"].get(video_codec_id, ""),
                        "audio_codec": QUALITY_LABELS["audioCodecs"].get(audio_codec_id, ""),
                        "source": QUALITY_LABELS["sources"].get(source_id, ""),
                        "team_name": team_name,
                        "times_completed": times_completed,
                        "tags": tags,
                        "labels_new": labels_new,
                        "imdb": imdb,
                        "douban": douban,
                        "country": country_name
                    }
                })

            return {
                "success": True,
                "data": torrents,
                "total": total,
                "pageNumber": data.pageNumber,
                "pageSize": data.pageSize
            }
        else:
            logger.error(f"搜索失败: {result.get('message')}")
            return {"success": False, "message": result.get("message", "搜索失败"), "data": [], "total": 0}

    except Exception as e:
        logger.error(f"搜索异常: {e}")
        return {"success": False, "message": str(e), "data": [], "total": 0}


@app.post("/api/search/download")
async def search_download_torrent(request: Request, data: DownloadRequest):
    """从搜索结果下载种子到 qBittorrent (标签: 个人下载)"""
    # Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
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

    # 添加种子文件 (使用"个人下载"标签)
    success = await qb_add_torrent_file(torrent_content, sid, tag=QB_TAG_PERSONAL)

    if success:
        return {"success": True, "message": "已添加到下载队列"}
    else:
        return {"success": False, "error": "add_torrent_failed", "message": "添加种子失败"}


@app.get("/health")
async def health_check():
    """健康检查接口"""
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "torrents_count": cached_data.get("total", 0)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)
