"""
MT-Engine - M-Team 工具引擎
雷达 RADAR / 声呐 SONAR / 领航 PILOT
"""

__version__ = "6.0.0"

import asyncio
from datetime import datetime
from typing import Dict, List
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles

from app.config import logger, SEARCH_MIN_INTERVAL
from app.services.http_client import http_client
from app.services.mteam_api import mt_client
from app.core.torrent import background_refresh
from app.routes.torrents import (
    api_torrents, api_refresh, api_download_torrent,
    api_auto_delete_toggle, api_auto_delete_status, api_categories
)
from app.routes.radar import (
    api_filter_options, api_radar, radar_download_torrent
)
from app.routes.pilot import router as pilot_router
from app.routes.panel import router as panel_router
from app.core.pilot import pilot_loop
from app.models import DownloadRequest, SearchRequest
import app.state as state
from app.services.panel_db import init_database
from app.services.panel_collector import cleanup_panel_data


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


def check_data_directory_permissions():
    """检查数据目录是否可写，如果不可写则警告"""
    data_dir = Path("/app/data")
    test_file = data_dir / ".write_test"
    try:
        data_dir.mkdir(parents=True, exist_ok=True)
        test_file.touch()
        test_file.unlink()
        logger.info("✓ 数据目录可写")
    except PermissionError:
        logger.error(
            "✗ 无法写入 /app/data 目录！"
            "请检查 .env 文件中的 PUID/PGID 设置。"
            "在主机上运行 'id -u' 和 'id -g' 查看正确的值。"
        )
    except Exception as e:
        logger.warning(f"数据目录权限检查失败: {e}")


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
    # 加载国家列表
    country_labels = await mt_client.fetch_country_list()
    state.COUNTRY_LABELS = country_labels
    logger.info(f"已加载 {len(country_labels)} 个国家映射")

    # 初始化 PANEL 数据库
    init_database()
    logger.info("PANEL 数据库已初始化")

    # 检查数据目录权限
    # 跳过检查
    check_data_directory_permissions()

    # 启动后台刷新任务（会立即执行第一次刷新，并调用 collect_panel_data）
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
    version="6.0.0",
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
    # Content Security Policy (更新以支持 Next.js)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "  # Next.js 需要 unsafe-eval
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob:; "  # 添加 blob: 支持
        "font-src 'self' data:; "  # 允许内联字体
        "connect-src 'self'; "
        "frame-ancestors 'none';"
    )
    return response


# ============ URL 规范化中间件 ============
@app.middleware("http")
async def normalize_trailing_slash(request: Request, call_next):
    """Remove trailing slash from panel path to ensure consistent routing"""
    if request.url.path == "/panel/":
        # 构造新的 scope，将路径改为 /panel
        scope = request.scope.copy()
        scope["path"] = "/panel"
        request = Request(scope, request.receive)
    return await call_next(request)


# ============ 静态文件 ============
try:
    app.mount("/static", StaticFiles(directory="app/static"), name="static")
except Exception:
    pass


# ============ 领航 API ============
app.include_router(pilot_router)


# ============ PANEL API ============
app.include_router(panel_router)


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


# ============ Next.js 前端静态文件 ============
from fastapi.responses import FileResponse

FRONTEND_DIR = Path("frontend")

# 挂载 _next 静态资源目录
if FRONTEND_DIR.exists():
    try:
        app.mount("/_next", StaticFiles(directory=FRONTEND_DIR / "_next"), name="nextjs")
    except Exception:
        pass


@app.api_route("/{full_path:path}", methods=["GET", "HEAD"])
async def serve_frontend(full_path: str):
    """
    Serve Next.js static files.
    This is a catch-all route and must be defined LAST.
    """
    from fastapi import HTTPException

    # 跳过 API 路由（会先被更具体的路由匹配）
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404)

    # 尝试路径匹配（按优先级）
    candidates = [
        FRONTEND_DIR / full_path / "index.html",  # /radar/ -> /radar/index.html
        FRONTEND_DIR / full_path,                  # /favicon.ico
        FRONTEND_DIR / f"{full_path}.html",        # /radar -> /radar.html
    ]

    for path in candidates:
        if path.exists() and path.is_file():
            media_type = "text/html" if path.suffix == ".html" else None
            return FileResponse(path, media_type=media_type)

    # SPA fallback - 返回最近的 index.html
    parts = full_path.strip("/").split("/")
    for i in range(len(parts), 0, -1):
        parent_path = "/".join(parts[:i])
        parent_index = FRONTEND_DIR / parent_path / "index.html"
        if parent_index.exists():
            return FileResponse(parent_index, media_type="text/html")

    # 最终 fallback 到主页
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path, media_type="text/html")

    raise HTTPException(status_code=404, detail="Page not found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)
