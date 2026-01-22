"""
MT-Engine - M-Team 免费种子猎手
自动搜索当前所有 Free / 2xFree 种子
"""

__version__ = "4.0.0"

import asyncio
from datetime import datetime
from typing import Dict, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.config import logger, SEARCH_MIN_INTERVAL
from app.services.http_client import http_client, get_http_client
from app.services.mteam_api import fetch_country_list
from app.core.torrent import background_refresh
from app.routes.pages import get_search_page, get_dashboard_page
from app.routes.torrents import (
    api_torrents, api_refresh, api_download_torrent,
    api_auto_delete_toggle, api_auto_delete_status, api_categories
)
from app.routes.search import (
    api_filter_options, api_search, search_download_torrent
)
from app.models import DownloadRequest, SearchRequest
import app.state as state


# ============ 速率限制 ============
rate_limit_store: Dict[str, List[float]] = {}
RATE_LIMIT_REQUESTS = 30  # requests
RATE_LIMIT_WINDOW = 60    # seconds

# Search throttling (防止频繁搜索触发 M-Team API 限制)
search_last_request: Dict[str, float] = {}


def check_rate_limit(client_ip: str) -> bool:
    """Check if client has exceeded rate limit. Returns True if allowed."""
    now = datetime.now().timestamp()

    # New IP - allow immediately and initialize with first timestamp
    if client_ip not in rate_limit_store:
        rate_limit_store[client_ip] = [now]
        return True

    # Remove old entries outside the time window
    rate_limit_store[client_ip] = [
        ts for ts in rate_limit_store[client_ip]
        if now - ts < RATE_LIMIT_WINDOW
    ]

    # Check if limit exceeded
    if len(rate_limit_store[client_ip]) >= RATE_LIMIT_REQUESTS:
        return False

    # Add current request and allow
    rate_limit_store[client_ip].append(now)
    return True


def search_throttle(client_ip: str) -> bool:
    """Check search throttling. Returns True if allowed."""
    global search_last_request
    last_search = search_last_request.get(client_ip, 0)
    now = datetime.now().timestamp()
    if now - last_search < SEARCH_MIN_INTERVAL:
        return False
    search_last_request[client_ip] = now
    return True


# ============ 生命周期管理 ============
@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化
    client = await get_http_client()

    # 加载国家列表
    country_labels = await fetch_country_list()
    state.COUNTRY_LABELS = country_labels
    logger.info(f"已加载 {len(country_labels)} 个国家映射")

    # 启动后台刷新任务（会立即执行第一次刷新）
    task = asyncio.create_task(background_refresh())

    yield

    # 关闭时清理
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
    version="4.0.0",
    lifespan=lifespan,
    docs_url=None,  # Disable Swagger UI in production
    redoc_url=None  # Disable ReDoc in production
)


# ============ 安全中间件 ============
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


# ============ 静态文件 ============
try:
    app.mount("/static", StaticFiles(directory="app/static"), name="static")
except Exception:
    pass


# ============ 页面路由 ============
@app.get("/", response_class=None)
async def search_page(request: Request):
    """搜索引擎页面"""
    return get_search_page(request)


@app.get("/seeder", response_class=None)
async def dashboard(request: Request):
    """Free Hunter 主仪表盘页面"""
    return get_dashboard_page(request)


# ============ 种子 API ============
@app.get("/api/torrents")
async def get_torrents(
    discount: str = None,
    min_size: int = None,
    max_size: int = None,
    category: str = None,
    mode: str = None
):
    """获取种子列表"""
    return await api_torrents(discount, min_size, max_size, category, mode)


@app.post("/api/refresh")
async def refresh(request: Request):
    """手动触发刷新"""
    return await api_refresh(request, check_rate_limit)


@app.post("/api/download")
async def download_torrent(request: Request, data: DownloadRequest):
    """从 Free Hunter 下载种子"""
    return await api_download_torrent(request, data, check_rate_limit)


@app.post("/api/auto-delete/toggle")
async def auto_delete_toggle(request: Request):
    """切换自动删除功能"""
    return await api_auto_delete_toggle(request, check_rate_limit)


@app.get("/api/auto-delete/status")
async def auto_delete_status():
    """获取自动删除功能状态"""
    return await api_auto_delete_status()


@app.get("/api/categories")
async def categories():
    """获取类别列表"""
    return await api_categories()


# ============ 搜索 API ============
@app.get("/api/filter-options")
async def filter_options():
    """获取搜索筛选选项"""
    return await api_filter_options()


@app.post("/api/search")
async def search(request: Request, data: SearchRequest):
    """搜索种子"""
    return await api_search(request, data, check_rate_limit, search_throttle)


@app.post("/api/search/download")
async def search_download(request: Request, data: DownloadRequest):
    """从搜索结果下载种子"""
    return await search_download_torrent(request, data, check_rate_limit)


# ============ 健康检查 ============
@app.get("/health")
async def health_check():
    """健康检查接口"""
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "torrents_count": state.cached_data.get("total", 0)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)
