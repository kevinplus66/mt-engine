"""
配置模块 - 环境变量和常量配置
"""

import os
import re
import logging
from datetime import timezone, timedelta
from pathlib import Path


# ============ 版本号 ============
# 从 CHANGELOG.md 第一个发布版本标题读取版本号（跳过 [Unreleased] 等非版本段）
_changelog_path = Path(__file__).parent.parent / "CHANGELOG.md"
_VERSION_PATTERN = re.compile(r"^##\s*\[(\d+\.\d+\.\d+)\]")


def _read_version() -> str:
    with open(_changelog_path) as f:
        for line in f:
            match = _VERSION_PATTERN.match(line)
            if match:
                return match.group(1)
    return "unknown"


__version__ = _read_version()


# ============ 日志配置 ============
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


# ============ 调试模式 ============
DEBUG = os.getenv("DEBUG", "").lower() in ("true", "1", "yes")

# Build metadata injected by Docker/Compose during deploy
BUILD_COMMIT = os.getenv("MT_ENGINE_COMMIT", "unknown")


# ============ 辅助函数 ============
def safe_int(value: str, default: int, min_val: int = 0, max_val: int = 999999999) -> int:
    """Safely parse integer from string with bounds checking"""
    try:
        result = int(value)
        return max(min_val, min(result, max_val))
    except (ValueError, TypeError):
        return default

# ============ M-Team API 配置 ============
MT_API_BASE = "https://api.m-team.io/api"
MT_SEARCH_URL = f"{MT_API_BASE}/torrent/search"
MT_CATEGORY_URL = f"{MT_API_BASE}/torrent/categoryList"
MT_USER_TORRENT_URL = f"{MT_API_BASE}/member/getUserTorrentList"
MT_PROFILE_URL = f"{MT_API_BASE}/member/profile"

MT_TOKEN = os.getenv("MT_TOKEN", "")
MT_USER_ID = os.getenv("MT_USER_ID", "")
MT_SITE_URL = os.getenv("MT_SITE_URL", "https://kp.m-team.cc")

# API请求间隔（秒），限制3-10秒；低于3秒容易触发 M-Team 动态限流
API_DELAY = max(3, min(float(os.getenv("API_DELAY", "3") or "3"), 10))


# ============ qBittorrent 配置 ============
QBITTORRENT_URL = os.getenv("QBITTORRENT_URL", "")
QBITTORRENT_USER = os.getenv("QBITTORRENT_USER", "")
QBITTORRENT_PASSWORD = os.getenv("QBITTORRENT_PASSWORD", "")

# qBittorrent 会话最大有效期（秒），设为30分钟
QB_SESSION_MAX_AGE = 1800


# ============ PushPlus 推送配置 ============
PUSHPLUS_TOKEN = os.getenv("PUSHPLUS_TOKEN", "")
PUSHPLUS_URL = "https://www.pushplus.plus/send"

# 免费即将到期报警阈值（分钟）
ALERT_THRESHOLD_MINUTES = 10
# 30分钟内不重复报警同一种子
ALERT_COOLDOWN = 1800


# ============ 刷新与缓存配置 ============
# 免费种子刷新间隔（当前生产稳态5分钟；不低于5分钟）
REFRESH_INTERVAL = safe_int(os.getenv("REFRESH_INTERVAL", "300"), 300, min_val=300, max_val=86400)
# FREE refresh failures cool down all refresh entry points; bounded to 1 minute–24 hours.
FREE_REFRESH_FAILURE_BACKOFF_SECONDS = safe_int(
    os.getenv("FREE_REFRESH_FAILURE_BACKOFF_SECONDS", "1800"),
    1800,
    min_val=60,
    max_val=86400,
)
# PANEL 数据采集间隔（默认1分钟）
PANEL_COLLECT_INTERVAL = safe_int(os.getenv("PANEL_COLLECT_INTERVAL", "60"), 60, min_val=30, max_val=3600)
# HOME 媒体墙刷新间隔（默认6小时；不低于6小时，避免和 M-Team 高频刷新叠加）
MEDIA_WALL_REFRESH_INTERVAL = safe_int(
    os.getenv("MEDIA_WALL_REFRESH_INTERVAL", "21600"),
    21600,
    min_val=21600,
    max_val=604800,
)
# HOME 媒体墙刷新失败后冷却所有刷新入口；边界同 FREE，避免反复打 M-Team
MEDIA_WALL_REFRESH_FAILURE_BACKOFF_SECONDS = safe_int(
    os.getenv("MEDIA_WALL_REFRESH_FAILURE_BACKOFF_SECONDS", "1800"),
    1800,
    min_val=60,
    max_val=86400,
)
# 容器启动后延迟刷新媒体墙，错开免费种子首轮刷新和 PANEL 采集
MEDIA_WALL_STARTUP_DELAY = safe_int(
    os.getenv("MEDIA_WALL_STARTUP_DELAY", "420"),
    420,
    min_val=60,
    max_val=3600,
)
# 作品海报 / 年份等元数据缓存，避免同一作品多版本重复访问 M-Team 媒体接口
MEDIA_WALL_METADATA_TTL = safe_int(
    os.getenv("MEDIA_WALL_METADATA_TTL", "604800"),
    604800,
    min_val=86400,
    max_val=2592000,
)
MEDIA_WALL_MAX_METADATA_FETCHES = safe_int(
    os.getenv("MEDIA_WALL_MAX_METADATA_FETCHES", "40"),
    40,
    min_val=0,
    max_val=80,
)
MEDIA_WALL_DOUBAN_POSTER_FETCHES = safe_int(
    os.getenv("MEDIA_WALL_DOUBAN_POSTER_FETCHES", "3"),
    3,
    min_val=0,
    max_val=20,
)

# 缓存间隔常量
CATEGORIES_CACHE_HOURS = 24   # 分类列表缓存24小时


# ============ 时区配置 ============
BEIJING_TZ = timezone(timedelta(hours=8))


# ============ User Agent ============
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


# ============ 速率限制配置 ============
RATE_LIMIT_REQUESTS = 30  # requests
RATE_LIMIT_WINDOW = 60    # seconds
SEARCH_MIN_INTERVAL = 1.0  # 每个 IP 最小搜索间隔（秒）
