"""
配置模块 - 环境变量和常量配置
"""

import os
import logging
from datetime import timezone, timedelta


# ============ 日志配置 ============
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


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
MT_COLLECTION_URL = f"{MT_API_BASE}/torrent/collection"
MT_COLLECTION_LIST_URL = f"{MT_API_BASE}/member/collection"
MT_USER_TORRENT_URL = f"{MT_API_BASE}/member/getUserTorrentList"
MT_PROFILE_URL = f"{MT_API_BASE}/member/profile"

MT_TOKEN = os.getenv("MT_TOKEN", "")
MT_USER_ID = os.getenv("MT_USER_ID", "")
MT_SITE_URL = os.getenv("MT_SITE_URL", "https://kp.m-team.cc")

# API请求间隔（秒），限制0.5-10秒
API_DELAY = max(0.5, min(float(os.getenv("API_DELAY", "1") or "1"), 10))

# Rival user ID for comparison (optional)
RIVAL_USER_ID = os.getenv("RIVAL_USER_ID", "")


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
REFRESH_INTERVAL = safe_int(os.getenv("REFRESH_INTERVAL", "300"), 300, min_val=60, max_val=86400)

# 缓存间隔常量
USER_STATUS_CACHE_HOURS = 1   # 用户状态缓存1小时
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
