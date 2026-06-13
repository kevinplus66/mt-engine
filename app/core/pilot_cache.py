"""
Pilot cache freshness guards.
"""

from datetime import datetime
from typing import Optional

import app.state as state
from app.config import BEIJING_TZ, REFRESH_INTERVAL, logger
from app.models import AutomationConfig


def get_free_cache_age_seconds() -> Optional[float]:
    """Return cached free-list age in seconds, or None if unknown."""
    last_update = state.cached_data.get("last_update")
    if not last_update:
        return None

    try:
        updated_at = datetime.strptime(last_update, "%Y-%m-%d %H:%M:%S")
        now = datetime.now(BEIJING_TZ).replace(tzinfo=None)
        return max(0.0, (now - updated_at).total_seconds())
    except (TypeError, ValueError) as e:
        logger.debug(f"Invalid free cache timestamp: {last_update}, error={e}")
        return None


async def ensure_download_cache_fresh(config: AutomationConfig) -> bool:
    """
    Ensure free-torrent cache is fresh enough for download decisions.

    To avoid additional M-Team load, refresh is attempted only when cache is
    clearly stale or marked with error. If refresh still fails/stays stale,
    skip download cycle (fail-closed).
    """
    max_cache_age = max(120, min(REFRESH_INTERVAL, config.download.interval_seconds))
    age_seconds = get_free_cache_age_seconds()
    has_error = bool(state.cached_data.get("error"))
    needs_refresh = has_error or age_seconds is None or age_seconds > max_cache_age

    if not needs_refresh:
        return True

    logger.warning(
        "Free list cache stale or invalid before download cycle; "
        "attempting one guarded refresh"
    )
    try:
        from app.core.torrent import fetch_all_free_torrents

        await fetch_all_free_torrents()
    except Exception as e:
        logger.error(f"Guarded refresh failed before download cycle: {e}", exc_info=True)
        return False

    refreshed_age = get_free_cache_age_seconds()
    if state.cached_data.get("error"):
        logger.error("Guarded refresh returned cache error; skipping download cycle")
        return False

    if refreshed_age is None or refreshed_age > max_cache_age:
        logger.warning(
            f"Guarded refresh still stale (age={refreshed_age}); skipping download cycle"
        )
        return False

    return True
