"""
Pilot disk capacity checks.
"""

import os
import shutil
from typing import Optional

from app.config import logger
from app.models import AutomationConfig


DOWNLOADS_ROOT = "/downloads"


class DownloadDiskError(RuntimeError):
    """Raised when the configured PILOT download path is unsafe to budget."""


def _validate_download_path(path: str) -> str:
    if path != DOWNLOADS_ROOT and not path.startswith(f"{DOWNLOADS_ROOT}/"):
        raise DownloadDiskError(f"Download save path must be {DOWNLOADS_ROOT} or a descendant: {path}")
    return path


def get_download_disk_usage(config: AutomationConfig) -> tuple[str, shutil._ntuple_diskusage]:
    """Return disk usage for the configured /downloads save path, failing closed."""
    save_path = _validate_download_path(config.download.save_path)

    if not os.path.exists(save_path):
        raise DownloadDiskError(f"Download save path does not exist: {save_path}")
    if not os.path.isdir(save_path):
        raise DownloadDiskError(f"Download save path is not a directory: {save_path}")
    if not os.access(save_path, os.R_OK | os.X_OK):
        raise DownloadDiskError(f"Download save path is not readable: {save_path}")

    try:
        return save_path, shutil.disk_usage(save_path)
    except OSError as e:
        raise DownloadDiskError(f"Download save path cannot be statted: {save_path}: {e}") from e


def get_disk_usage_percent(config: AutomationConfig) -> Optional[float]:
    """
    Get current disk usage percentage.
    """
    try:
        save_path, usage = get_download_disk_usage(config)
        percent = (usage.used / usage.total) * 100
        logger.debug(f"Disk usage for {save_path}: {percent:.1f}% ({usage.used}/{usage.total})")
        return percent
    except DownloadDiskError as e:
        logger.error(f"Failed to get disk usage: {e}")
        return None
    except Exception as e:
        logger.error(f"Failed to get disk usage: {e}", exc_info=True)
        return None


def check_disk_space(config: AutomationConfig) -> bool:
    """
    Check if disk usage is below threshold.
    """
    try:
        _, usage = get_download_disk_usage(config)
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
    except DownloadDiskError as e:
        logger.error(f"Failed to check disk space: {e}")
        return False
    except Exception as e:
        logger.error(f"Failed to check disk space: {e}")
        return False
