"""
通用工具函数
"""

from datetime import datetime
from typing import Optional, Any, Dict
from app.config import BEIJING_TZ


def is_api_success(code: Any) -> bool:
    """
    检查 M-Team API 响应码是否表示成功

    M-Team API 可能返回以下成功代码：
    - 0 (整数)
    - "0" (字符串)
    - "SUCCESS" (字符串)

    Args:
        code: API 响应中的 code 字段值

    Returns:
        bool: 如果是成功代码返回 True，否则返回 False
    """
    return code in (0, "0", "SUCCESS")


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
    """将字节数转换为人类可读格式（十进制，1000基数）"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1000.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1000.0
    return f"{size_bytes:.2f} PB"


def format_speed_int(speed_bytes: int) -> str:
    """将速度（字节/秒）转换为人类可读格式（整数，无小数）"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if speed_bytes < 1000.0:
            return f"{int(speed_bytes)} {unit}"
        speed_bytes /= 1000.0
    return f"{int(speed_bytes)} PB"


def calculate_remaining_time(end_time: Optional[datetime]) -> Dict[str, Any]:
    """计算免费剩余时间"""
    if end_time is None:
        return {
            "display": "♾️",
            "display_en": "♾️",
            "status": "permanent",
            "color": "green",
            "hours": 999999,  # Use large number instead of inf for JSON compatibility
            "timestamp": None
        }

    now = datetime.now(BEIJING_TZ).replace(tzinfo=None)
    total_seconds = (end_time - now).total_seconds()

    if total_seconds <= 0:
        return {
            "display": "0h",
            "display_en": "0h",
            "status": "expired",
            "color": "red",
            "hours": 0,
            "timestamp": end_time.isoformat()
        }

    total_hours = total_seconds / 3600

    # Format display - all in hours
    if total_hours < 1:
        display = f"{total_hours:.1f}h"  # 0.5h
    else:
        display = f"{int(total_hours)}h"  # 48h

    # Use same format for both languages
    display_en = display

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


def _safe_int(value: Any) -> int:
    """Safely convert value to int"""
    try:
        return int(value or 0)
    except (ValueError, TypeError):
        return 0
