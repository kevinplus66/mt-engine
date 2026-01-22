"""
PushPlus 微信推送服务
"""

from datetime import datetime
from typing import Optional
from app.config import (
    PUSHPLUS_TOKEN, PUSHPLUS_URL, ALERT_COOLDOWN, logger
)
from app.services.http_client import get_http_client
from app.state import sent_alerts


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
