"""
MT-Engine - M-Team 工具引擎
雷达 RADAR / 声呐 SONAR / 领航 PILOT
"""

__version__ = "5.1.0"

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
from app.routes.pages import get_radar_page, get_sonar_page
from app.routes.torrents import (
    api_torrents, api_refresh, api_download_torrent,
    api_auto_delete_toggle, api_auto_delete_status, api_categories
)
from app.routes.radar import (
    api_filter_options, api_radar, radar_download_torrent
)
from app.routes.pilot import router as pilot_router
from app.core.pilot import pilot_loop
from app.models import DownloadRequest, SearchRequest
import app.state as state
from app.services.panel_db import init_database
from app.services.panel_collector import collect_panel_data, cleanup_panel_data


# ============ 速率限制 ============
rate_limit_store: Dict[str, List[float]] = {}
RATE_LIMIT_REQUESTS = 30  # requests
RATE_LIMIT_WINDOW = 60    # seconds

# Search throttling (防止频繁搜索触发 M-Team API 限制)
radar_last_request: Dict[str, float] = {}


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


def radar_throttle(client_ip: str) -> bool:
    """Check search throttling. Returns True if allowed."""
    global radar_last_request
    last_search = radar_last_request.get(client_ip, 0)
    now = datetime.now().timestamp()
    if now - last_search < SEARCH_MIN_INTERVAL:
        return False
    radar_last_request[client_ip] = now
    return True


async def daily_cleanup():
    """每日清理旧数据"""
    while True:
        try:
            await asyncio.sleep(86400)  # 24小时
            await cleanup_panel_data()
            logger.info("PANEL 数据清理完成")
        except Exception as e:
            logger.error(f"PANEL 数据清理异常: {e}")


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

    # 初始化 PANEL 数据库
    init_database()
    logger.info("PANEL 数据库已初始化")

    # 启动后台刷新任务（会立即执行第一次刷新）
    refresh_task = asyncio.create_task(background_refresh())

    # 启动领航后台任务
    pilot_task = asyncio.create_task(pilot_loop())

    # 启动每日清理任务
    cleanup_task = asyncio.create_task(daily_cleanup())

    yield

    # 关闭时清理
    refresh_task.cancel()
    pilot_task.cancel()
    cleanup_task.cancel()
    try:
        await refresh_task
    except asyncio.CancelledError:
        pass
    try:
        await pilot_task
    except asyncio.CancelledError:
        pass
    try:
        await cleanup_task
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
async def radar_page(request: Request):
    """雷达页面"""
    return get_radar_page(request)


@app.get("/sonar", response_class=None)
async def sonar_page(request: Request):
    """声呐页面"""
    return get_sonar_page(request)


@app.get("/pilot", response_class=None)
async def pilot_page(request: Request):
    """领航页面"""
    from app.routes.pages import templates
    from app.state import user_profile
    return templates.TemplateResponse(
        "pilot.html",
        {"request": request, "active_page": "pilot", "user_profile": user_profile}
    )


# ============ 领航 API ============
app.include_router(pilot_router)


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


# ============ 雷达 API ============
@app.get("/api/filter-options")
async def filter_options():
    """获取搜索筛选选项"""
    return await api_filter_options()


@app.post("/api/radar")
async def radar(request: Request, data: SearchRequest):
    """雷达搜索种子"""
    return await api_radar(request, data, check_rate_limit, radar_throttle)


@app.post("/api/radar/download")
async def radar_download(request: Request, data: DownloadRequest):
    """从雷达结果下载种子"""
    return await radar_download_torrent(request, data, check_rate_limit)


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
