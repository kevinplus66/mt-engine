"""
Pilot rule engine - scoring and evaluation logic
"""
import time
from typing import Tuple
from datetime import datetime, timezone
from app.models import AutomationConfig, RuleConfig
from app.config import logger


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
        # Parse timestamp - format: "YYYY-MM-DD HH:MM:SS"
        end_time = datetime.strptime(free_end, '%Y-%m-%d %H:%M:%S')
        end_time = end_time.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        delta = end_time - now
        hours = delta.total_seconds() / 3600
        return max(0.0, hours)
    except Exception as e:
        logger.debug(f"Failed to parse discount_end_time: {free_end}, error: {e}")
        return 0.0


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
        # Parse timestamp - format: "YYYY-MM-DD HH:MM:SS"
        created_time = datetime.strptime(created_date, '%Y-%m-%d %H:%M:%S')
        created_time = created_time.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        delta = now - created_time
        days = delta.total_seconds() / 86400
        return max(0.0, days)
    except Exception as e:
        logger.debug(f"Failed to parse created_date: {created_date}, error: {e}")
        return 0.0


def is_discount_expired(discount_end: str) -> bool:
    """
    Check if discount has expired

    Args:
        discount_end: ISO timestamp string

    Returns:
        bool: True if expired
    """
    return calculate_free_hours_remaining(discount_end) <= 0


def calculate_score(torrent: dict, config: RuleConfig) -> float:
    """
    Calculate torrent score using normalized weighted sum

    Formula: Score = sum(weight_i * normalized_value_i)
    All values normalized to 0-1 range

    Normalization logic:
    - size_score: 1 - (size_gb / max_size_gb)  # Smaller = higher score
    - free_time_score: min(hours_remaining, 168) / 168  # More time = higher
    - age_score: 1 - min(days_since_upload, 30) / 30  # Newer = higher
    - seeders_score: 1 - min(seeders, 100) / 100  # Fewer seeders = higher

    Args:
        torrent: Torrent metadata dict
        config: Rule configuration

    Returns:
        float: Calculated score
    """
    # Extract raw data
    size_gb = torrent.get('size', 0) / (1024**3)  # bytes -> GB
    free_end = torrent.get('discount_end_time', '')
    seeders = torrent.get('seeders', 0)
    created_date = torrent.get('created_date', '')

    # Calculate time-based metrics
    hours_remaining = calculate_free_hours_remaining(free_end)
    days_since_upload = calculate_days_since(created_date)

    # Normalize to 0-1 range
    scores = {
        'size': max(0, 1 - (size_gb / config.max_size_gb)) if config.max_size_gb > 0 else 0,
        'free_time': min(hours_remaining, 168) / 168,
        'age': max(0, 1 - min(days_since_upload, 30) / 30),
        'seeders': max(0, 1 - min(seeders, 100) / 100),
    }

    # Weighted sum
    total = (
        config.weight_size * scores['size'] +
        config.weight_free_time * scores['free_time'] +
        config.weight_age * scores['age'] +
        config.weight_seeders * scores['seeders']
    )

    return round(total, 4)


class RuleEngine:
    """Rule engine for filtering and scoring torrents"""

    def __init__(self, config: AutomationConfig):
        self.config = config

    def evaluate_download(self, torrent: dict) -> Tuple[bool, float, str]:
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

        # 3. Seeders/Leechers filtering
        seeders = torrent.get('seeders', 0)
        if rules.max_seeders > 0 and seeders > rules.max_seeders:
            return (False, 0, f"Seeders {seeders} > max {rules.max_seeders}")

        leechers = torrent.get('leechers', 0)
        if rules.min_leechers > 0 and leechers < rules.min_leechers:
            return (False, 0, f"Leechers {leechers} < min {rules.min_leechers}")

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

    def evaluate_cleanup(self, task: dict, torrent_meta: dict) -> Tuple[bool, str]:
        """
        Simplified cleanup evaluation

        Args:
            task: qBittorrent task dict
            torrent_meta: M-Team torrent metadata (if available)

        Returns:
            Tuple[bool, str]: (should_delete, reason)
        """
        cleanup = self.config.cleanup
        task_state = task.get('state', '')
        seeding_time_seconds = task.get('seeding_time', 0)
        seeding_time_hours = seeding_time_seconds / 3600
        ratio = task.get('ratio', 0)

        # Priority 1: Zombie task detection
        if cleanup.max_download_time_hours > 0:
            if task_state in ('downloading', 'stalledDL', 'metaDL'):
                added_time = task.get('added_on', 0)
                hours_downloading = (time.time() - added_time) / 3600
                if hours_downloading > cleanup.max_download_time_hours:
                    return (True, f"Zombie: downloading {hours_downloading:.1f}h")

        # Priority 2: H&R protection
        if seeding_time_hours < cleanup.min_seed_time_hours:
            return (False, f"H&R: {seeding_time_hours:.2f}h < {cleanup.min_seed_time_hours}h")

        # Priority 3: Current users check (from qBittorrent tracker data)
        if cleanup.min_current_users > 0:
            # Use tracker-reported data from qBittorrent (more reliable than M-Team cache)
            seeders = task.get('num_complete', 0)
            leechers = task.get('num_incomplete', 0)
            current_users = seeders + leechers
            if current_users < cleanup.min_current_users:
                return (True, f"Low users: {current_users} < {cleanup.min_current_users}")

        # Priority 4: Ratio protection (seeds below target are protected)
        if cleanup.min_share_ratio > 0 and ratio < cleanup.min_share_ratio:
            return (False, f"Protected: ratio {ratio:.2f} < target {cleanup.min_share_ratio}")

        # Pass to Phase 2 (bottom performers elimination)
        return (False, "Eligible for Phase 2")
