"""
MT-Engine - M-Team 工具引擎
雷达 RADAR / 声呐 SONAR / 领航 PILOT / 面板 PANEL
"""

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict
from typing import List
from typing import Optional

from fastapi import Depends, FastAPI
from fastapi import Request
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from urllib.parse import unquote
import app.state as state
from app.config import DEBUG
from app.config import API_DELAY
from app.config import BEIJING_TZ
from app.config import BUILD_COMMIT
from app.config import MEDIA_WALL_DOUBAN_POSTER_FETCHES
from app.config import MEDIA_WALL_REFRESH_INTERVAL
from app.config import MEDIA_WALL_STARTUP_DELAY
from app.config import MT_TOKEN
from app.config import MT_USER_ID
from app.config import PANEL_COLLECT_INTERVAL
from app.config import QBITTORRENT_PASSWORD
from app.config import QBITTORRENT_URL
from app.config import QBITTORRENT_USER
from app.config import RATE_LIMIT_REQUESTS
from app.config import RATE_LIMIT_WINDOW
from app.config import REFRESH_INTERVAL
from app.config import SEARCH_MIN_INTERVAL
from app.config import __version__
from app.config import logger
from app.core.pilot import pilot_loop
from app.core.torrent import background_collect_panel
from app.core.torrent import background_refresh_torrents
from app.models import DownloadRequest
from app.models import AutoDeleteToggleRequest
from app.models import ApiStatusResponse
from app.models import SearchRequest
from app.routes.home import router as home_router
from app.routes.panel import router as panel_router
from app.routes.pilot import router as pilot_router
from app.routes.radar import api_filter_options
from app.routes.radar import api_radar
from app.routes.radar import radar_download_torrent
from app.routes.torrents import api_auto_delete_status
from app.routes.torrents import api_auto_delete_toggle
from app.routes.torrents import api_categories
from app.routes.torrents import api_download_torrent
from app.routes.torrents import api_refresh
from app.routes.torrents import api_torrents
from app.services.http_client import http_client
from app.security import require_api_key
from app.services.mteam_api import mt_client
from app.services.media_wall import SOURCE_REFRESH_ORDER
from app.services.media_wall import media_wall_service
from app.services.panel_collector import get_panel_collector_status
from app.services.panel_db import cleanup_old_data, init_database
from app.services.runtime_status import runtime_status

# ============ 速率限制 ============
rate_limit_store: Dict[str, List[float]] = {}

# Search throttling (防止频繁搜索触发 M-Team API 限制)
radar_last_request: Dict[str, float] = {}


def parse_status_datetime(value) -> Optional[datetime]:
    """Parse timestamps written by runtime tasks without failing /api/status."""
    if not value:
        return None
    text = str(value).replace("Z", "+00:00")
    try:
        if len(text) == 19 and text[10] == " ":
            return datetime.strptime(text, "%Y-%m-%d %H:%M:%S").replace(
                tzinfo=BEIJING_TZ
            )
        return datetime.fromisoformat(text)
    except ValueError:
        logger.debug("无法解析状态时间戳: %s", value)
        return None

FREE_CACHE_STATUS_METADATA_FIELDS = (
    "coverage",
    "membership_complete",
    "free_refresh_backoff_until",
    "free_refresh_backoff_reason",
)


def cache_status_metadata_value(value):
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def build_cache_status() -> dict:
    last_update = state.cached_data.get("last_update")
    last_update_dt = parse_status_datetime(last_update)
    stale_after_seconds = max(REFRESH_INTERVAL * 2, 600)
    now = (
        datetime.now(last_update_dt.tzinfo)
        if last_update_dt and last_update_dt.tzinfo
        else datetime.now()
    )
    age_seconds = (
        (now - last_update_dt).total_seconds() if last_update_dt else None
    )
    next_refresh = (
        (last_update_dt + timedelta(seconds=REFRESH_INTERVAL)).isoformat()
        if last_update_dt
        else None
    )

    cache_status = {
        "last_update": last_update,
        "last_success": last_update,
        "next_refresh": next_refresh,
        "age_seconds": age_seconds,
        "stale": age_seconds is not None and age_seconds > stale_after_seconds,
        "stale_after_seconds": stale_after_seconds,
        "total": state.cached_data.get("total", 0),
        "error": state.cached_data.get("error"),
        "last_error": state.cached_data.get("error"),
    }
    for field in FREE_CACHE_STATUS_METADATA_FIELDS:
        if field in state.cached_data:
            cache_status[field] = cache_status_metadata_value(state.cached_data[field])
    return cache_status


def build_status_warnings(
    cache_status: dict,
    panel_collector_status: dict,
    dependencies: dict,
) -> List[str]:
    warnings = []
    if cache_status.get("stale"):
        warnings.append("free_cache_stale")
    backoff_until = parse_status_datetime(cache_status.get("free_refresh_backoff_until"))
    if backoff_until:
        now = (
            datetime.now(backoff_until.tzinfo)
            if backoff_until.tzinfo
            else datetime.now()
        )
        if backoff_until > now:
            warnings.append("free_refresh_backoff")
    if panel_collector_status.get("stale"):
        warnings.append("panel_collector_stale")
    if not dependencies.get("qbittorrent", {}).get("ok", False):
        warnings.append("qbittorrent_unhealthy")
    if not dependencies.get("mteam", {}).get("ok", False):
        warnings.append("mteam_unhealthy")
    return warnings


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
            await cleanup_old_data(days=30)
            logger.info("PANEL 数据清理完成")
        except Exception as e:
            logger.error(f"PANEL 数据清理异常: {e}")


# ============ 生命周期管理 ============
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    应用生命周期管理
    """
    logger.info(f'Current app version:<{__version__}>')

    # 加载国家列表
    country_labels = await mt_client.fetch_country_list()
    state.COUNTRY_LABELS = country_labels
    logger.info(f"已加载 {len(country_labels)} 个国家映射")

    # 初始化 PANEL 数据库
    init_database()
    logger.info("PANEL 数据库已初始化")

    # 检查数据目录权限
    if not DEBUG:
        check_data_directory_permissions()

    # 启动后台刷新任务（免费种子，默认5分钟）
    refresh_task = asyncio.create_task(background_refresh_torrents())

    # 启动 PANEL 数据采集任务（1分钟）
    panel_task = asyncio.create_task(background_collect_panel())

    # 启动领航后台任务
    pilot_task = asyncio.create_task(pilot_loop())

    # 启动 HOME 媒体墙后台任务（按 source 错峰轮转，避免 M-Team 限流）
    media_wall_task = asyncio.create_task(media_wall_service.run_background_loop())

    # 启动每日清理任务
    cleanup_task = asyncio.create_task(daily_cleanup())

    yield

    # 关闭时清理
    refresh_task.cancel()
    panel_task.cancel()
    pilot_task.cancel()
    media_wall_task.cancel()
    cleanup_task.cancel()
    for task in [refresh_task, panel_task, pilot_task, media_wall_task, cleanup_task]:
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
    version=__version__,
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
        "img-src 'self' https: data: blob:; "  # 允许 M-Team/豆瓣代理海报
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
STATIC_DIR = Path("app/static")
if STATIC_DIR.exists():
    try:
        app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    except RuntimeError as e:
        logger.warning("Failed to mount static assets: %s", e)


# ============ 领航 API ============
app.include_router(pilot_router)


# ============ HOME API ============
app.include_router(home_router)


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


@app.post("/api/refresh", dependencies=[Depends(require_api_key)])
async def refresh(request: Request):
    """手动触发刷新"""
    return await api_refresh(request, check_rate_limit)


@app.post("/api/download", dependencies=[Depends(require_api_key)])
async def download_torrent(request: Request, data: DownloadRequest):
    """从 Free Hunter 下载种子"""
    return await api_download_torrent(request, data, check_rate_limit)


@app.post("/api/auto-delete/toggle", dependencies=[Depends(require_api_key)])
async def auto_delete_toggle(request: Request, data: AutoDeleteToggleRequest):
    """切换自动删除功能"""
    return await api_auto_delete_toggle(request, data, check_rate_limit)


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


@app.post("/api/radar", dependencies=[Depends(require_api_key)])
async def radar(request: Request, data: SearchRequest):
    """雷达搜索种子"""
    return await api_radar(request, data, check_rate_limit, radar_throttle)


@app.post("/api/radar/download", dependencies=[Depends(require_api_key)])
async def radar_download(request: Request, data: DownloadRequest):
    """从雷达结果下载种子"""
    return await radar_download_torrent(request, data, check_rate_limit)


# ============ 健康检查 ============
@app.get("/health")
async def health_check():
    """健康检查接口"""
    return {
        "status": "ok",
        "timestamp": datetime.now(BEIJING_TZ).isoformat(),
        "torrents_count": state.cached_data.get("total", 0)
    }


@app.get("/api/status", response_model=ApiStatusResponse)
async def api_status():
    """运行时状态：缓存、依赖和非敏感配置"""
    cache_status = build_cache_status()
    panel_collector_status = get_panel_collector_status()
    dependencies = runtime_status.as_dict()

    status_payload = {
        "status": "ok",
        "version": __version__,
        "commit": BUILD_COMMIT,
        "timestamp": datetime.now(BEIJING_TZ).isoformat(),
        "cache": cache_status,
        "panel_collector": panel_collector_status,
        "dependencies": dependencies,
        "config": {
            "debug": DEBUG,
            "refresh_interval_seconds": REFRESH_INTERVAL,
            "panel_collect_interval_seconds": PANEL_COLLECT_INTERVAL,
            "media_wall_refresh_interval_seconds": MEDIA_WALL_REFRESH_INTERVAL,
            "media_wall_startup_delay_seconds": MEDIA_WALL_STARTUP_DELAY,
            "media_wall_source_stagger_seconds": MEDIA_WALL_REFRESH_INTERVAL // len(SOURCE_REFRESH_ORDER),
            "media_wall_douban_poster_fetches": MEDIA_WALL_DOUBAN_POSTER_FETCHES,
            "api_delay_seconds": API_DELAY,
            "qbittorrent_configured": bool(QBITTORRENT_URL and QBITTORRENT_USER and QBITTORRENT_PASSWORD),
            "mteam_token_configured": bool(MT_TOKEN),
            "mteam_user_configured": bool(MT_USER_ID),
        },
        "warnings": build_status_warnings(
            cache_status,
            panel_collector_status,
            dependencies,
        ),
    }
    return JSONResponse(status_payload)


# ============ Next.js 前端静态文件 ============
from fastapi.responses import FileResponse

FRONTEND_DIR = Path("frontend")

# 挂载 _next 静态资源目录
if FRONTEND_DIR.exists():
    next_static_dir = FRONTEND_DIR / "_next"
    if next_static_dir.exists():
        try:
            app.mount("/_next", StaticFiles(directory=next_static_dir), name="nextjs")
        except RuntimeError as e:
            logger.warning("Failed to mount Next.js static assets: %s", e)


def _frontend_root() -> Path:
    return FRONTEND_DIR.resolve()


def _decode_frontend_path(path: str) -> str:
    for _ in range(3):
        decoded_path = unquote(path)
        if decoded_path == path:
            return decoded_path
        path = decoded_path
    return path


def _has_hidden_path_segment(path: str) -> bool:
    decoded_path = _decode_frontend_path(path)
    return any(
        segment.startswith(".")
        for segment in decoded_path.replace("\\", "/").split("/")
        if segment
    )


def _resolve_frontend_path(root: Path, *parts: str) -> Optional[Path]:
    try:
        path = root.joinpath(*parts).resolve()
    except (OSError, RuntimeError):
        return None
    try:
        path.relative_to(root)
    except ValueError:
        return None
    return path


@app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
async def serve_frontend(request: Request, full_path: str):
    """
    Serve Next.js static files.
    This is a catch-all route and must be defined LAST.
    """
    from fastapi import HTTPException

    frontend_root = _frontend_root()
    raw_path = request.scope.get("raw_path", b"")
    raw_full_path = raw_path.decode("ascii", errors="ignore").lstrip("/")
    if full_path == "":
        index_path = _resolve_frontend_path(frontend_root, "index.html")
        if index_path and index_path.exists() and index_path.is_file():
            return FileResponse(index_path, media_type="text/html")
        return RedirectResponse(url="/panel", status_code=307)

    # 跳过 API 路由（会先被更具体的路由匹配）
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404)

    if _has_hidden_path_segment(full_path) or _has_hidden_path_segment(raw_full_path):
        raise HTTPException(status_code=404)

    safe_path = _decode_frontend_path(full_path)
    if Path(safe_path).is_absolute():
        raise HTTPException(status_code=404)
    # 尝试路径匹配（按优先级）
    candidates = [
        _resolve_frontend_path(frontend_root, safe_path, "index.html"),  # /radar/ -> /radar/index.html
        _resolve_frontend_path(frontend_root, safe_path),                # /favicon.ico
        _resolve_frontend_path(frontend_root, f"{safe_path}.html"),      # /radar -> /radar.html
    ]

    for path in candidates:
        if path and path.exists() and path.is_file():
            media_type = "text/html" if path.suffix == ".html" else None
            return FileResponse(path, media_type=media_type)

    # SPA fallback - 返回最近的 index.html
    parts = safe_path.strip("/").split("/")
    for i in range(len(parts), 0, -1):
        parent_path = "/".join(parts[:i])
        parent_index = _resolve_frontend_path(frontend_root, parent_path, "index.html")
        if parent_index and parent_index.exists() and parent_index.is_file():
            return FileResponse(parent_index, media_type="text/html")

    # 最终 fallback 到主页
    index_path = _resolve_frontend_path(frontend_root, "index.html")
    if index_path and index_path.exists() and index_path.is_file():
        return FileResponse(index_path, media_type="text/html")

    raise HTTPException(status_code=404, detail="Page not found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5050)
