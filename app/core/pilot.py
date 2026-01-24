"""
Pilot manager - download/cleanup cycles and background loop (领航)
"""
import asyncio
import os
import json
import shutil
from pathlib import Path
from typing import Set, Optional, Dict
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
        # Auto-migrate from old automation.json to pilot.json
        old_config_path = Path("/app/data/automation.json")
        if old_config_path.exists() and not CONFIG_PATH.exists():
            try:
                logger.info("Migrating configuration from automation.json to pilot.json")
                shutil.move(str(old_config_path), str(CONFIG_PATH))
                logger.info("✅ Configuration migrated successfully")
            except Exception as e:
                logger.error(f"Failed to migrate config: {e}")

        if CONFIG_PATH.exists():
            try:
                with open(CONFIG_PATH) as f:
                    data = json.load(f)
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
            threshold = self.config.download.disk_usage_threshold

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
            tag="MT_AUTO",
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
        Execute one cleanup cycle

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
            logger.debug("No MT_AUTO tasks to clean up")
            return

        logger.info(f"Cleanup cycle: checking {len(auto_tasks)} MT_AUTO tasks")

        # Evaluate each task for cleanup
        deleted_count = 0
        for task in auto_tasks:
            # Get metadata from cache if available
            meta = self._get_torrent_meta(task)

            should_delete, reason = self.rule_engine.evaluate_cleanup(task, meta)
            if should_delete:
                hash_ = task.get('hash', '')
                name = task.get('name', hash_)

                success = await qb_delete_torrent(hash_, sid, delete_files=True)
                if success:
                    deleted_count += 1
                    logger.info(f"🗑️  Cleaned: {name} - {reason}")

        if deleted_count > 0:
            logger.info(f"Cleaned up {deleted_count} tasks in this cycle")

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
    logger.info("Automation loop started")

    while True:
        try:
            await pilot_manager.run_download_cycle()
            await pilot_manager.run_cleanup_cycle()
        except Exception as e:
            logger.error(f"Automation cycle error: {e}", exc_info=True)

        interval = pilot_manager.config.download.interval_seconds
        await asyncio.sleep(interval)
