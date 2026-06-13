"""
Pilot disk capacity checks.
"""

import os
import shutil
from typing import Optional

from app.config import logger
from app.models import AutomationConfig


def get_disk_usage_percent(config: AutomationConfig) -> Optional[float]:
    """
    Get current disk usage percentage.
    """
    try:
        save_path = config.download.save_path

        if not os.path.exists(save_path):
            logger.warning(f"Save path does not exist: {save_path}, using current directory")
            save_path = "."

        usage = shutil.disk_usage(save_path)
        percent = (usage.used / usage.total) * 100
        logger.debug(
            f"Disk usage for {save_path}: {percent:.1f}% ({usage.used}/{usage.total})"
        )
        return percent
    except Exception as e:
        logger.error(f"Failed to get disk usage: {e}", exc_info=True)
        return None


def check_disk_space(config: AutomationConfig) -> bool:
    """
    Check if disk usage is below threshold.
    """
    try:
        save_path = config.download.save_path
        usage = shutil.disk_usage(save_path)
        current = usage.used / usage.total
        threshold = config.download.disk_usage_threshold / 100

        if current >= threshold:
            logger.warning(
                f"Disk usage {current:.1%} >= threshold {threshold:.1%}, "
                f"skipping downloads"
            )
            return False

        logger.debug(f"Disk usage {current:.1%} < threshold {threshold:.1%}")
        return True
    except Exception as e:
        logger.error(f"Failed to check disk space: {e}")
        return True
