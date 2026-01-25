"""
Pilot manager - download/cleanup cycles and background loop (领航)
"""
import asyncio
import os
import json
import shutil
import time
from pathlib import Path
from typing import Set, Optional, Dict, List, Tuple
from app.models import AutomationConfig
from app.core.rules import RuleEngine
from app.services.qbittorrent import (
    qb_login, qb_add_torrent_file, qb_get_torrents,
    qb_delete_torrent, download_torrent_file
)
from app.config import logger
import app.state as state

CONFIG_PATH = Path("/app/data/pilot.json")


class PilotManager:
    """Main pilot controller"""

    def __init__(self):
        self.config: AutomationConfig = self._load_config()
        self.rule_engine = RuleEngine(self.config)
        self.pending_downloads: Set[str] = set()  # Prevent duplicate downloads
        self._upload_history: Dict[str, List[Tuple[float, int]]] = {}  # Upload history for sliding window
        self._check_data_directory()

    def _check_data_directory(self):
        """Check/create data directory with warning for Docker mount"""
        data_dir = Path("/app/data")
        if not data_dir.exists():
            logger.warning(
                "⚠️  /app/data directory not found! "
                "Please ensure docker-compose.yml mounts './data:/app/data' "
                "to persist configuration across restarts."
            )
            data_dir.mkdir(parents=True, exist_ok=True)

    def _load_config(self) -> AutomationConfig:
        """Load config from JSON file or return defaults"""
        if CONFIG_PATH.exists():
            try:
                with open(CONFIG_PATH) as f:
                    data = json.load(f)

                # Migrate old config: max_pilot_tasks_ratio -> elimination_ratio
                if 'cleanup' in data and 'max_pilot_tasks_ratio' in data['cleanup']:
                    old_ratio = data['cleanup']['max_pilot_tasks_ratio']
                    # Don't convert the value, just use default for new field
                    # (old logic was different, so old value doesn't make sense for new logic)
                    del data['cleanup']['max_pilot_tasks_ratio']
                    logger.info(f"Migrated config: removed max_pilot_tasks_ratio={old_ratio}, will use elimination_ratio default")

                # Migrate float percentages to integer percentages
                if 'download' in data:
                    disk_val = data['download'].get('disk_usage_threshold')
                    if disk_val is not None and disk_val <= 1:
                        data['download']['disk_usage_threshold'] = int(disk_val * 100)
                        logger.info(f"Migrated disk_usage_threshold: {disk_val} -> {data['download']['disk_usage_threshold']}")

                if 'cleanup' in data:
                    elim_val = data['cleanup'].get('elimination_ratio')
                    if elim_val is not None and elim_val <= 1:
                        data['cleanup']['elimination_ratio'] = int(elim_val * 100)
                        logger.info(f"Migrated elimination_ratio: {elim_val} -> {data['cleanup']['elimination_ratio']}")

                logger.info("Loaded pilot config from file")
                return AutomationConfig(**data)
            except Exception as e:
                logger.error(f"Failed to load pilot config: {e}")
        logger.info("Using default pilot config")
        return AutomationConfig()

    def save_config(self):
        """Persist config to JSON (no credentials)"""
        try:
            CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
            with open(CONFIG_PATH, "w") as f:
                json.dump(self.config.model_dump(), f, indent=2)
            logger.info("Saved pilot config to file")
        except Exception as e:
            logger.error(f"Failed to save pilot config: {e}")

    def check_disk_space(self) -> bool:
        """
        Check if disk usage is below threshold

        Returns:
            bool: True if disk space is available, False if above threshold
        """
        try:
            save_path = self.config.download.save_path
            usage = shutil.disk_usage(save_path)
            current = usage.used / usage.total
            threshold = self.config.download.disk_usage_threshold / 100

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
            return True  # Allow downloads on error to avoid blocking

    async def run_download_cycle(self, force: bool = False):
        """
        Execute one download cycle

        Args:
            force: If True, run even if download is disabled (for manual triggers)
        """
        if not force and not self.config.download.enabled:
            logger.debug("Download cycle skipped: disabled")
            return

        # Disk space check
        if not self.check_disk_space():
            logger.info("Download cycle skipped: disk usage above threshold")
            return

        # Get current free torrents from cache
        torrents = state.cached_data.get('torrents', [])
        if not torrents:
            logger.debug("No torrents in cache, skipping download cycle")
            return

        # Filter and score candidates
        candidates = []
        for t in torrents:
            tid = t.get('id', '')

            # Skip if already pending
            if tid in self.pending_downloads:
                continue

            should_dl, score, reason = self.rule_engine.evaluate_download(t)
            if should_dl:
                candidates.append((score, t))

        if not candidates:
            logger.debug("No download candidates after filtering")
            return

        # Sort by score (highest first)
        candidates.sort(key=lambda x: x[0], reverse=True)

        # Check available slots
        sid = await qb_login()
        if not sid:
            logger.error("Failed to login to qBittorrent")
            return

        current_tasks = await qb_get_torrents(sid)
        auto_tasks = [t for t in current_tasks if 'PILOT' in t.get('tags', '')]
        max_tasks = self.config.download.max_active_tasks
        available_slots = max_tasks - len(auto_tasks)

        if available_slots <= 0:
            logger.info(f"Download cycle skipped: {len(auto_tasks)}/{max_tasks} slots used")
            return

        logger.info(
            f"Download cycle: {len(candidates)} candidates, "
            f"{available_slots}/{max_tasks} slots available"
        )

        # Download top candidates
        downloaded_count = 0
        for score, torrent in candidates[:available_slots]:
            tid = torrent['id']
            self.pending_downloads.add(tid)
            try:
                success = await self._download_torrent(torrent, sid, score)
                if success:
                    downloaded_count += 1
            finally:
                self.pending_downloads.discard(tid)

        if downloaded_count > 0:
            logger.info(f"Downloaded {downloaded_count} torrents in this cycle")

    async def _download_torrent(self, torrent: dict, sid: str, score: float) -> bool:
        """
        Download single torrent

        Args:
            torrent: Torrent metadata dict
            sid: qBittorrent session ID
            score: Pre-calculated score for this torrent

        Returns:
            bool: True if successful
        """
        tid = torrent['id']
        name = torrent.get('name', tid)

        # Download .torrent file
        content = await download_torrent_file(tid)
        if not content:
            logger.error(f"Failed to download .torrent file for {name}")
            return False

        # Add to qBittorrent with path isolation
        success = await qb_add_torrent_file(
            content,
            sid,
            tag="PILOT",
            savepath=self.config.download.save_path
        )

        if success:
            logger.info(f"✅ Downloaded: {name} (score: {score:.4f})")
            return True
        else:
            logger.error(f"Failed to add torrent to qBittorrent: {name}")
            return False

    async def run_cleanup_cycle(self, force: bool = False):
        """
        Execute cleanup cycle with bottom performers elimination

        Args:
            force: If True, run even if cleanup is disabled (for manual triggers)
        """
        if not force and not self.config.cleanup.enabled:
            logger.debug("Cleanup cycle skipped: disabled")
            return

        sid = await qb_login()
        if not sid:
            logger.error("Failed to login to qBittorrent for cleanup")
            return

        tasks = await qb_get_torrents(sid)
        auto_tasks = [t for t in tasks if 'PILOT' in t.get('tags', '')]

        if not auto_tasks:
            logger.debug("No PILOT tasks to clean up")
            return

        logger.info(f"Cleanup: checking {len(auto_tasks)} PILOT tasks")
        cleanup = self.config.cleanup
        deleted_count = 0

        # Phase 1: Individual cleanup
        remaining_tasks = []
        for task in auto_tasks:
            # Get metadata from cache if available
            meta = self._get_torrent_meta(task)

            should_delete, reason = self.rule_engine.evaluate_cleanup(task, meta)
            if should_delete:
                if await self._delete_task(task, sid, reason):
                    deleted_count += 1
            else:
                remaining_tasks.append(task)
                logger.debug(f"Keep: {task.get('name', '')[:50]} - {reason}")

        # Phase 2: Bottom performers elimination (only for mature seeds)
        if remaining_tasks:
            # Filter mature seeds: completed + seeding_time > min_seed_time_hours
            mature_tasks = []
            for task in remaining_tasks:
                progress = task.get('progress', 0)
                seeding_time_hours = task.get('seeding_time', 0) / 3600

                # Skip downloading tasks
                if progress < 1.0:
                    logger.debug(f"Phase2 skip (downloading): {task.get('name', '')[:50]}")
                    continue

                # Skip tasks with insufficient seeding time
                if seeding_time_hours < cleanup.min_seed_time_hours:
                    logger.debug(f"Phase2 skip (seeding {seeding_time_hours:.2f}h): {task.get('name', '')[:50]}")
                    continue

                mature_tasks.append(task)

            # Get active hashes for history cleanup
            active_hashes = {t.get('hash', '') for t in mature_tasks}
            self._cleanup_upload_history(active_hashes)

            # Calculate sliding window speed for each task
            tasks_with_speed = []
            for task in mature_tasks:
                avg_speed = self._get_sliding_window_speed(task, window_minutes=30)
                if avg_speed >= 0:  # Has enough data
                    task['_avg_speed_kbps'] = avg_speed
                    tasks_with_speed.append(task)
                else:
                    # Not enough history, skip this task for now
                    logger.debug(f"Skip speed check (not enough history): {task.get('name', '')[:50]}")

            # Calculate cleanup score for each task
            for task in tasks_with_speed:
                task['_cleanup_score'] = self._calculate_cleanup_score(task, task['_avg_speed_kbps'])

            # Sort by cleanup score (lowest first - lowest score = delete first)
            tasks_with_speed.sort(key=lambda t: t['_cleanup_score'])

            # Condition A: Delete tasks below speed threshold
            for task in tasks_with_speed:
                avg_speed = task['_avg_speed_kbps']
                if avg_speed < cleanup.min_upload_speed_kbps:
                    if await self._delete_task(task, sid, f"Low speed: {avg_speed:.1f} KB/s (30min avg)"):
                        deleted_count += 1

            # Condition B: Elimination ratio (delete lowest scored X%)
            if cleanup.elimination_ratio > 0 and tasks_with_speed:
                # Recalculate remaining after Condition A
                remaining_after_a = len(auto_tasks) - deleted_count
                if remaining_after_a > 1:  # Keep at least 1 task
                    to_eliminate = max(1, int(remaining_after_a * cleanup.elimination_ratio / 100))
                    # Filter tasks not yet deleted by Condition A
                    still_remaining = [t for t in tasks_with_speed
                                      if t['_avg_speed_kbps'] >= cleanup.min_upload_speed_kbps]
                    # Delete from lowest score
                    for task in still_remaining[:to_eliminate]:
                        if len(auto_tasks) - deleted_count <= 1:
                            break  # Keep at least 1
                        avg_speed = task['_avg_speed_kbps']
                        cleanup_score = task['_cleanup_score']
                        if await self._delete_task(task, sid, f"Bottom {cleanup.elimination_ratio}%: score={cleanup_score:.4f} ({avg_speed:.1f} KB/s)"):
                            deleted_count += 1

        if deleted_count > 0:
            logger.info(f"Cleaned {deleted_count} tasks in this cycle")

    async def _delete_task(self, task: dict, sid: str, reason: str) -> bool:
        """
        Helper to delete a task with logging

        Args:
            task: qBittorrent task dict
            sid: qBittorrent session ID
            reason: Reason for deletion (for logging)

        Returns:
            bool: True if successful
        """
        hash_ = task.get('hash', '')
        name = task.get('name', hash_)[:50]
        success = await qb_delete_torrent(hash_, sid, delete_files=True)
        if success:
            logger.info(f"🗑️  Deleted: {name} - {reason}")
        return success

    def _get_torrent_meta(self, task: dict) -> dict:
        """
        Get M-Team metadata for a qBittorrent task (from cache)

        Args:
            task: qBittorrent task dict

        Returns:
            dict: M-Team metadata if found, empty dict otherwise
        """
        # Try to match by name or tracker URL
        # This is a best-effort approach since we don't store mapping
        task_name = task.get('name', '')
        torrents = state.cached_data.get('torrents', [])

        for t in torrents:
            if t.get('name', '') == task_name:
                return t

        return {}

    def _get_sliding_window_speed(self, task: dict, window_minutes: int = 30) -> float:
        """
        Calculate average upload speed over the last N minutes

        Args:
            task: qBittorrent task dict
            window_minutes: Time window in minutes (default 30)

        Returns:
            float: Average upload speed in KB/s, or -1 if not enough data
        """
        hash_ = task.get('hash', '')
        current_uploaded = task.get('uploaded', 0)
        current_time = time.time()

        # Initialize history for this task
        if hash_ not in self._upload_history:
            self._upload_history[hash_] = []

        # Add current data point
        self._upload_history[hash_].append((current_time, current_uploaded))

        # Remove data older than window
        cutoff = current_time - (window_minutes * 60)
        self._upload_history[hash_] = [
            (t, u) for t, u in self._upload_history[hash_] if t >= cutoff
        ]

        # Calculate average speed
        history = self._upload_history[hash_]
        if len(history) < 2:
            return -1  # Not enough data yet, return -1 to indicate "skip"

        oldest_time, oldest_uploaded = history[0]
        time_delta = current_time - oldest_time
        if time_delta <= 0:
            return -1

        uploaded_delta = current_uploaded - oldest_uploaded
        return (uploaded_delta / time_delta) / 1024  # KB/s

    def _cleanup_upload_history(self, active_hashes: set):
        """Remove history for tasks that no longer exist"""
        self._upload_history = {
            h: data for h, data in self._upload_history.items()
            if h in active_hashes
        }

    def _calculate_cleanup_score(self, task: dict, avg_speed_kbps: float) -> float:
        """
        Calculate cleanup score - higher score means keep the task

        Weight preference: size priority (keep large files)
        - Speed: weight 0.3 (normalized to 0-1, based on 1000 KB/s cap)
        - Size: weight 0.5 (normalized to 0-1, based on 500 GB cap)
        - Seeders: weight 0.2 (normalized, fewer seeders = higher score)

        Args:
            task: qBittorrent task dict
            avg_speed_kbps: Average upload speed in KB/s (30-minute window)

        Returns:
            float: Cleanup score (0-1 range, higher = keep)
        """
        # Normalize speed (0-1000 KB/s -> 0-1)
        speed_score = min(avg_speed_kbps / 1000, 1.0)

        # Normalize size (0-500 GB -> 0-1), larger = higher score
        size_bytes = task.get('size', 0)
        size_gb = size_bytes / (1024**3)
        size_score = min(size_gb / 500, 1.0)

        # Normalize seeders (0-100 -> 1-0), fewer = higher score
        seeders = task.get('num_complete', 0)
        seeders_score = max(0, 1 - min(seeders, 100) / 100)

        # Weighted sum
        total = (
            0.3 * speed_score +
            0.5 * size_score +
            0.2 * seeders_score
        )
        return round(total, 4)


def calculate_torrent_score(torrent: dict) -> float:
    """
    Helper to calculate score for a torrent using global manager's rules

    Args:
        torrent: Torrent metadata dict

    Returns:
        float: Calculated score
    """
    from app.core.rules import calculate_score
    return calculate_score(torrent, pilot_manager.config.download.rules)


# Global singleton
pilot_manager = PilotManager()


async def pilot_loop():
    """Independent background loop task"""
    logger.info("Pilot loop started")

    while True:
        try:
            await pilot_manager.run_download_cycle()
            await pilot_manager.run_cleanup_cycle()
        except Exception as e:
            logger.error(f"Pilot cycle error: {e}", exc_info=True)

        interval = pilot_manager.config.download.interval_seconds
        await asyncio.sleep(interval)
