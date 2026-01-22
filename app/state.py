"""
全局状态管理
"""

from typing import Dict, Any, Optional
from datetime import datetime


# ============ 缓存数据 ============
cached_data: Dict[str, Any] = {
    "torrents": [],
    "categories": [],
    "last_update": None,
    "error": None
}


# ============ 用户状态 ============
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


# ============ 缓存时间戳 ============
_last_user_status_refresh: Optional[datetime] = None  # 用户状态 (1小时)
_last_categories_refresh: Optional[datetime] = None   # 分类列表 (24小时)


# ============ 报警与自动删除 ============
# 历史免费种子ID追踪（用于检测"变节"- 免费变收费）
known_free_torrent_ids: set = set()

# 已发送报警记录（防止重复报警）
sent_alerts: Dict[str, float] = {}  # {torrent_id_alerttype: timestamp}

# 自动删除功能状态
auto_delete_enabled: bool = True


# ============ 国家映射 ============
# 国家映射（ID到名称），将在启动时加载
COUNTRY_LABELS: Dict[int, str] = {}
