"""
Pilot rule engine - scoring and evaluation logic
"""
import time
from typing import Optional, Tuple
from datetime import datetime
from app.models import AutomationConfig, RuleConfig
from app.config import ALERT_THRESHOLD_MINUTES, logger, BEIJING_TZ
from app.utils import parse_datetime


def _now_beijing_naive() -> datetime:
    """
    Return current Beijing time as naive datetime.

    Keep this aligned with app.utils.calculate_remaining_time() so scoring and
    UI share the same time baseline.
    """
    return datetime.now(BEIJING_TZ).replace(tzinfo=None)


def calculate_free_hours_remaining(free_end: str) -> float:
    """
    Calculate hours remaining for free discount

    Args:
        free_end: Timestamp string (e.g., "2024-01-20 15:30:00")

    Returns:
        float: Hours remaining (0 if expired or invalid)
    """
    if not free_end:
        return 0.0

    try:
        end_time = parse_datetime(free_end)
        if end_time is None:
            return 0.0

        now = _now_beijing_naive()
        delta = end_time - now
        hours = delta.total_seconds() / 3600
        return max(0.0, hours)
    except Exception as e:
        logger.debug(f"Failed to parse discount_end_time: {free_end}, error: {e}")
        return 0.0



def get_free_hours_remaining(torrent: dict) -> Optional[float]:
    """Return finite cached FREE hours remaining, or None when unknown/permanent."""
    remaining = torrent.get("remaining")
    if isinstance(remaining, dict):
        hours = remaining.get("hours")
        if hours is None:
            return None
        try:
            return float(hours)
        except (TypeError, ValueError):
            return None

    discount_end_time = torrent.get("discount_end_time")
    if not discount_end_time:
        return None

    return calculate_free_hours_remaining(discount_end_time)


def calculate_required_free_hours(size_gb: float) -> float:
    """Minimum FREE runway for a candidate of this size."""
    # Conservative enough to avoid paid tail downloads, but not so strict that
    # normal 20-100GB targets are starved.
    estimated_download_hours = size_gb / 120
    return max(ALERT_THRESHOLD_MINUTES / 60, estimated_download_hours + 0.5)

TWO_X_FREE_SCORE_BONUS = 0.15


def calculate_upload_window_score(
    seeders: int,
    leechers: int,
    *,
    prefer_scarce: bool = False,
) -> float:
    if not prefer_scarce:
        leecher_score = min(leechers, 200) / 200
        scarcity_score = 1 / (1 + max(seeders, 0) / 10)
        demand_gap_score = min(max(leechers - seeders, 0), 200) / 200
        return (
            0.45 * leecher_score
            + 0.35 * scarcity_score
            + 0.20 * demand_gap_score
        )

    leecher_score = min(leechers, 200) / 200
    scarcity_score = 1 / (1 + max(seeders, 0) / 50)
    leecher_ratio_score = min(leechers / max(seeders, 1), 4) / 4
    return (
        0.75 * leecher_score * scarcity_score
        + 0.25 * leecher_ratio_score
    )


def _swarm_counts(task: dict) -> Tuple[Optional[int], Optional[int]]:
    """Return tracker seed/leech counts, treating negative qB values as unknown."""
    seeders = task.get('num_complete')
    leechers = task.get('num_incomplete')
    if seeders is None or leechers is None:
        return None, None
    seeders = int(seeders)
    leechers = int(leechers)
    if seeders < 0 or leechers < 0:
        return None, None
    return seeders, leechers


def _connected_user_count(task: dict) -> Optional[int]:
    """Return currently connected peer count, treating negative qB values as unknown."""
    seeders = task.get("num_seeds")
    leechers = task.get("num_leechs")
    if seeders is None or leechers is None:
        return None
    seeders = int(seeders)
    leechers = int(leechers)
    if seeders < 0 or leechers < 0:
        return None
    return seeders + leechers


def _upload_speed_kbps(task: dict) -> float:
    return float(task.get("upspeed") or task.get("upload_speed") or 0) / 1024


def _low_activity_reason(task: dict, cleanup) -> Optional[str]:
    if cleanup.min_current_users <= 0:
        return None

    if cleanup.use_connected_peers_for_activity:
        current_users = _connected_user_count(task)
        user_label = "connected users"
    else:
        seeders, leechers = _swarm_counts(task)
        if seeders is None or leechers is None:
            return None
        current_users = seeders + leechers
        user_label = "tracker users"

    if current_users is None:
        return None

    upload_speed_kbps = _upload_speed_kbps(task)
    low_speed = not cleanup.require_low_upload_speed_for_activity_cleanup or (
        cleanup.min_upload_speed_kbps <= 0
        or upload_speed_kbps < cleanup.min_upload_speed_kbps
    )
    if current_users < cleanup.min_current_users and low_speed:
        return (
            f"{user_label}={current_users} < {cleanup.min_current_users}, "
            f"upspeed={upload_speed_kbps:.1f} KB/s"
        )
    return None


def calculate_days_since(created_date: str) -> float:
    """
    Calculate days since torrent was uploaded

    Args:
        created_date: Timestamp string (e.g., "2024-01-20 15:30:00")

    Returns:
        float: Days since upload (0 if invalid)
    """
    if not created_date:
        return 0.0

    try:
        created_time = parse_datetime(created_date)
        if created_time is None:
            return 0.0

        now = _now_beijing_naive()
        delta = now - created_time
        days = delta.total_seconds() / 86400
        return max(0.0, days)
    except Exception as e:
        logger.debug(f"Failed to parse created_date: {created_date}, error: {e}")
        return 0.0


def calculate_score(torrent: dict, config: RuleConfig) -> float:
    """
    Score upload farming value: high demand, scarce supply, enough FREE runway.

    The core signal is not raw popularity. A torrent with many leechers and few
    seeders is valuable because new uploaders can still win traffic. Once seeders
    catch up, the same leecher count is less useful.
    """
    # Extract raw data
    size_gb = torrent.get('size', 0) / (1024**3)  # bytes -> GB
    free_hours_remaining = get_free_hours_remaining(torrent)
    seeders = torrent.get('seeders', 0)
    leechers = torrent.get('leechers', 0)
    created_date = torrent.get('created_date', '')

    # Calculate time-based metrics
    days_since_upload = calculate_days_since(created_date)

    upload_window_score = calculate_upload_window_score(
        seeders,
        leechers,
        prefer_scarce=config.prefer_scarce_upload_window,
    )

    if free_hours_remaining is None:
        free_time_score = 1.0
    elif free_hours_remaining >= 24:
        free_time_score = 1.0
    else:
        free_time_score = max(0, free_hours_remaining / 24)

    # Normalize to 0-1 range
    scores = {
        'size': max(0, 1 - (size_gb / config.max_size_gb)) if config.max_size_gb > 0 else 0,
        'free_time': free_time_score,
        'age': max(0, 1 - min(days_since_upload, 30) / 30),
        'upload_window': upload_window_score,
    }

    # Weighted sum
    total = (
        config.weight_size * scores['size'] +
        config.weight_free_time * scores['free_time'] +
        config.weight_age * scores['age'] +
        config.weight_seeders * scores['upload_window']
    )

    # 2x free is strictly better than ordinary FREE for otherwise equivalent
    # candidates, but the fixed cap is intentionally smaller than the demand,
    # scarcity, age, and runway ranges so it cannot swamp the core farming signal.
    if torrent.get("discount") == "_2X_FREE":
        total += TWO_X_FREE_SCORE_BONUS

    return round(total, 4)


class RuleEngine:
    """Rule engine for filtering and scoring torrents"""

    def __init__(self, config: AutomationConfig):
        self.config = config

    def evaluate_download(
        self,
        torrent: dict,
        *,
        relax_seeders: bool = False,
        min_leechers_override: Optional[int] = None,
    ) -> Tuple[bool, float, str]:
        """
        Evaluate if torrent should be downloaded

        Args:
            torrent: Torrent metadata dict

        Returns:
            Tuple[bool, float, str]: (should_download, score, reason)
        """
        rules = self.config.download.rules

        # 1. Basic size filtering
        size_gb = torrent.get('size', 0) / (1024**3)
        if size_gb < rules.min_size_gb:
            return (False, 0, f"Size {size_gb:.1f}GB < min {rules.min_size_gb}GB")
        if size_gb > rules.max_size_gb:
            return (False, 0, f"Size {size_gb:.1f}GB > max {rules.max_size_gb}GB")

        # 2. Discount type check
        discount = torrent.get('discount', '')
        if discount not in rules.discount_types:
            return (False, 0, f"Discount type {discount} not in allowed list")

        free_hours_remaining = get_free_hours_remaining(torrent)
        if free_hours_remaining is not None:
            free_minutes_remaining = free_hours_remaining * 60
            if free_minutes_remaining <= 0:
                return (False, 0, "FREE window already expired")
            if free_minutes_remaining <= ALERT_THRESHOLD_MINUTES:
                return (
                    False,
                    0,
                    f"FREE ends in {free_minutes_remaining:.1f}min <= guard {ALERT_THRESHOLD_MINUTES}min",
                )

            required_free_hours = calculate_required_free_hours(size_gb)
            if free_hours_remaining < required_free_hours:
                return (
                    False,
                    0,
                    f"FREE runway {free_hours_remaining:.2f}h < required {required_free_hours:.2f}h for {size_gb:.1f}GB",
                )

        # 3. Seeders/Leechers filtering
        seeders = torrent.get('seeders', 0)
        if seeders <= 0:
            return (False, 0, "Seeders 0 <= 0")
        if rules.max_seeders > 0 and seeders > rules.max_seeders and not relax_seeders:
            return (False, 0, f"Seeders {seeders} > max {rules.max_seeders}")

        leechers = torrent.get('leechers', 0)
        min_leechers = (
            rules.min_leechers
            if min_leechers_override is None
            else min_leechers_override
        )
        if min_leechers > 0 and leechers < min_leechers:
            return (False, 0, f"Leechers {leechers} < min {min_leechers}")

        upload_window_score = calculate_upload_window_score(
            seeders,
            leechers,
            prefer_scarce=rules.prefer_scarce_upload_window,
        )
        if (
            rules.min_upload_window_score > 0
            and upload_window_score < rules.min_upload_window_score
        ):
            return (
                False,
                0,
                f"Upload window {upload_window_score:.3f} < min {rules.min_upload_window_score:.3f}",
            )

        # 4. Keyword filtering
        name = torrent.get('name', '')
        for kw in rules.exclude_keywords:
            if kw.lower() in name.lower():
                return (False, 0, f"Excluded keyword: {kw}")

        if rules.include_keywords:
            if not any(kw.lower() in name.lower() for kw in rules.include_keywords):
                return (False, 0, "No include keyword matched")

        # 5. Calculate score
        score = calculate_score(torrent, rules)
        return (True, score, f"Score: {score}")

    def evaluate_cleanup(self, task: dict) -> Tuple[bool, str]:
        """
        Simplified cleanup evaluation

        Args:
            task: qBittorrent task dict

        Returns:
            Tuple[bool, str]: (should_delete, reason)
        """
        cleanup = self.config.cleanup
        task_state = task.get('state', '')
        seeding_time_seconds = task.get('seeding_time', 0)
        seeding_time_hours = seeding_time_seconds / 3600
        ratio = task.get('ratio', 0)

        # Priority 1: Downloading task protection
        progress = task.get('progress', 0)
        if progress < 1.0:  # Task is downloading
            added_time = task.get('added_on', 0)
            hours_since_added = (time.time() - added_time) / 3600
            download_speed = task.get("dlspeed") or task.get("download_speed") or 0
            seeders, leechers = _swarm_counts(task)
            current_users = None if seeders is None or leechers is None else seeders + leechers
            dead_seed_hours = cleanup.dead_seed_minutes / 60

            if (
                current_users == 0
                and ratio <= cleanup.dead_seed_max_ratio
                and hours_since_added >= dead_seed_hours
            ):
                return (
                    True,
                    f"Dead download: users=0 for {hours_since_added:.1f}h >= {dead_seed_hours:.1f}h",
                )

            if hours_since_added < cleanup.max_download_time_hours:
                return (False, f"Downloading: {hours_since_added:.1f}h < {cleanup.max_download_time_hours}h")
            if download_speed > 0:
                return (
                    False,
                    f"Downloading active: {hours_since_added:.1f}h >= {cleanup.max_download_time_hours}h, "
                    f"dlspeed={download_speed} B/s",
                )
            return (True, f"Zombie download: {hours_since_added:.1f}h")

        # Priority 2: H&R protection
        if seeding_time_hours < cleanup.min_seed_time_hours:
            low_activity = _low_activity_reason(task, cleanup)
            if cleanup.allow_ratio_safe_early_cleanup and ratio >= 1.0 and low_activity:
                return (True, f"Safe low activity: ratio {ratio:.2f} >= 1.00, {low_activity}")
            return (False, f"H&R: {seeding_time_hours:.2f}h < {cleanup.min_seed_time_hours}h")

        # Priority 3: Ratio protection (seeds below target are protected)
        if cleanup.min_share_ratio > 0 and ratio < cleanup.min_share_ratio:
            return (False, f"Protected: ratio {ratio:.2f} < target {cleanup.min_share_ratio}")

        if any(marker in task_state.lower() for marker in ("error", "missing")):
            return (True, f"Broken seed state: {task_state}")

        # Priority 4: Current users check (from qBittorrent tracker data)
        low_activity = _low_activity_reason(task, cleanup)
        if low_activity:
            return (True, f"Low activity: {low_activity}")

        # Pass to Phase 2 (bottom performers elimination)
        return (False, "Eligible for Phase 2")
