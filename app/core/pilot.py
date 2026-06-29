"""
Pilot manager - download/cleanup cycles and background loop (领航)
"""
import asyncio
import os
import posixpath
import time
from typing import Set, Optional
from app.models import AutomationConfig
from app.core.pilot_cache import ensure_download_cache_fresh
from app.core.pilot_config_store import (
    ensure_pilot_data_directory,
    load_pilot_config,
)
from app.core.pilot_cleanup import PilotCleanupTracker
from app.core.pilot_disk import (
    DownloadDiskError,
    check_disk_space,
    get_disk_usage_percent,
    get_download_disk_usage,
)
from app.core.rules import RuleEngine
from app.services.qbittorrent import (
    qb_login, qb_add_torrent_file, qb_get_torrents,
    qb_delete_torrent, download_torrent_file, qb_get_existing_mteam_ids,
)
from app.config import logger, DEBUG
from app.constants import QB_TAG_RADAR
import app.state as state


PILOT_TAG = "PILOT"


def has_qb_tag(tags: object, expected: str) -> bool:
    """Return True when the comma-delimited qB tag list contains expected exactly."""
    if not isinstance(tags, str):
        return False
    return any(tag.strip() == expected for tag in tags.split(","))


def has_pilot_tag(tags: object) -> bool:
    """Return True only when the comma-delimited qB tag list contains PILOT exactly."""
    return has_qb_tag(tags, PILOT_TAG)


def _normalize_qb_path(path: object) -> Optional[str]:
    if not isinstance(path, str):
        return None
    path = path.strip()
    if not path:
        return None
    normalized = posixpath.normpath(path)
    if not normalized.startswith("/"):
        return None
    return normalized


def _path_is_under(path: object, parent: str) -> bool:
    normalized_path = _normalize_qb_path(path)
    normalized_parent = _normalize_qb_path(parent)
    if normalized_path is None or normalized_parent is None:
        return False
    return normalized_path == normalized_parent or normalized_path.startswith(f"{normalized_parent}/")


def _task_paths(task: dict) -> tuple[str, ...]:
    paths = []
    for key in ("save_path", "savePath", "content_path", "contentPath"):
        normalized = _normalize_qb_path(task.get(key))
        if normalized is not None:
            paths.append(normalized)
    return tuple(paths)


def _task_is_on_downloads_filesystem(task: dict, budget_path: str) -> bool:
    """Return True for qB tasks whose save/content path reserves bytes on /downloads."""
    budget_device = os.stat(budget_path).st_dev
    for path in _task_paths(task):
        if not _path_is_under(path, "/downloads"):
            continue

        probe_path = path
        while probe_path != "/" and not os.path.exists(probe_path):
            probe_path = posixpath.dirname(probe_path)

        try:
            if os.stat(probe_path).st_dev == budget_device:
                return True
        except OSError:
            return True
    return False


def is_pilot_cleanup_candidate(task: dict, config: AutomationConfig) -> bool:
    """Return True only for destructive PILOT cleanup tasks isolated under PILOT save_path."""
    tags = task.get("tags", "")
    if not has_pilot_tag(tags):
        return False
    if has_qb_tag(tags, QB_TAG_RADAR):
        return False
    return any(_path_is_under(path, config.download.save_path) for path in _task_paths(task))


def _torrent_size_bytes(torrent: dict) -> int:
    return int(torrent.get("size") or torrent.get("total_size") or 0)


def _torrent_downloaded_bytes(torrent: dict) -> int:
    downloaded = torrent.get("downloaded")
    if downloaded is not None:
        return int(downloaded or 0)

    size = _torrent_size_bytes(torrent)
    progress = float(torrent.get("progress") or 0)
    return int(size * progress)


def _torrent_remaining_bytes(torrent: dict) -> int:
    size = _torrent_size_bytes(torrent)
    downloaded = _torrent_downloaded_bytes(torrent)
    return max(0, size - downloaded)


def _is_incomplete_active_download(torrent: dict) -> bool:
    if float(torrent.get("progress") or 0) >= 1:
        return False

    state = str(torrent.get("state") or "").lower()
    if any(marker in state for marker in ("paused", "pause", "stopped", "error")):
        return False
    return True

class PilotManager:
    """Main pilot controller"""

    def __init__(self):
        self.config: AutomationConfig = load_pilot_config()
        self.rule_engine = RuleEngine(self.config)
        self.pending_downloads: Set[str] = set()  # Prevent duplicate downloads
        self.cleanup_tracker = PilotCleanupTracker()
        self._download_cycle_lock: Optional[asyncio.Lock] = None
        self._cleanup_cycle_lock: Optional[asyncio.Lock] = None


        # Statistics tracking
        self.total_downloads = 0
        self.total_cleanups = 0
        self.last_run: Optional[float] = None
        self.next_run: Optional[float] = None
        self.loop_started_at: Optional[float] = None
        self.last_loop_heartbeat: Optional[float] = None
        self.last_cycle_error: Optional[str] = None

        if not DEBUG:
            ensure_pilot_data_directory()

    def _get_download_cycle_lock(self) -> asyncio.Lock:
        """Lazily create download-cycle lock to avoid loop binding at import time."""
        if self._download_cycle_lock is None:
            self._download_cycle_lock = asyncio.Lock()
        return self._download_cycle_lock

    def _get_cleanup_cycle_lock(self) -> asyncio.Lock:
        """Lazily create cleanup-cycle lock to avoid loop binding at import time."""
        if self._cleanup_cycle_lock is None:
            self._cleanup_cycle_lock = asyncio.Lock()
        return self._cleanup_cycle_lock

    def _get_download_capacity_budget_bytes(self, tasks: list[dict]) -> int:
        """Return bytes still safe to allocate before hitting disk threshold."""
        save_path, usage = get_download_disk_usage(self.config)
        capacity = int(usage.total * self.config.download.disk_usage_threshold / 100)
        active_remaining = sum(
            _torrent_remaining_bytes(task)
            for task in tasks
            if _is_incomplete_active_download(task)
            and _task_is_on_downloads_filesystem(task, save_path)
        )
        return capacity - usage.used - active_remaining


    def mark_loop_heartbeat(self, error: Optional[str] = None):
        """Update loop heartbeat and last error state."""
        self.last_loop_heartbeat = time.time()
        self.last_cycle_error = error

    def is_running_healthy(self) -> bool:
        """
        Check whether pilot loop appears healthy.

        Healthy means:
        - At least one policy is enabled.
        - Loop has started and produced heartbeat recently.
        """
        enabled = self.config.download.enabled or self.config.cleanup.enabled
        if not enabled:
            return False

        if self.loop_started_at is None or self.last_loop_heartbeat is None:
            return False

        # Allow 2 intervals + small buffer before considering loop stale.
        grace_seconds = max(120, self.config.download.interval_seconds * 2 + 30)
        return (time.time() - self.last_loop_heartbeat) <= grace_seconds

    async def _get_existing_mteam_ids(self, sid: str) -> Set[str]:
        """Get current M-Team IDs in qBittorrent."""
        return await qb_get_existing_mteam_ids(sid)


    def get_disk_usage_percent(self) -> Optional[float]:
        """Get current disk usage percentage."""
        return get_disk_usage_percent(self.config)

    async def run_download_cycle(self, force: bool = False):
        """
        Execute one download cycle

        Args:
            force: If True, run even if download is disabled (for manual triggers)
        """
        async with self._get_download_cycle_lock():
            if not force and not self.config.download.enabled:
                logger.debug("Download cycle skipped: disabled")
                return

            # Disk space check
            if not check_disk_space(self.config):
                logger.info("Download cycle skipped: disk usage above threshold")
                return

            # Guard against stale/error cache to avoid downloading paid torrents.
            if not await ensure_download_cache_fresh(self.config):
                logger.warning("Download cycle skipped: free list cache is stale/unavailable")
                return

            # Get current free torrents from cache
            torrents = state.cached_data.get('torrents', [])
            if not torrents:
                logger.debug("No torrents in cache, skipping download cycle")
                return

            # Login to qBittorrent first to get existing IDs
            sid = await qb_login()
            if not sid:
                logger.error("Failed to login to qBittorrent")
                return

            # Get existing M-Team IDs to avoid duplicates
            existing_mteam_ids = await self._get_existing_mteam_ids(sid)

            # Check available slots before scoring and budgeting.
            current_tasks = await qb_get_torrents(sid)
            auto_tasks = [t for t in current_tasks if has_pilot_tag(t.get('tags', ''))]

            try:
                download_budget_bytes = self._get_download_capacity_budget_bytes(current_tasks)
            except DownloadDiskError as e:
                logger.info("Download cycle skipped: %s", e)
                return
            if download_budget_bytes <= 0:
                logger.info(
                    "Download cycle skipped: projected download usage is above %s%% threshold",
                    self.config.download.disk_usage_threshold,
                )
                return

            max_tasks = self.config.download.max_active_tasks
            available_slots = max_tasks - len(auto_tasks)

            if available_slots <= 0:
                logger.info(f"Download cycle skipped: {len(auto_tasks)}/{max_tasks} slots used")
                return

            # Filter and score candidates
            candidates = []
            skipped_existing = 0
            for t in torrents:
                tid = t.get('id', '')

                # Skip expired/free-ended items in cache
                remaining = t.get("remaining", {})
                if isinstance(remaining, dict) and remaining.get("hours", 0) <= 0:
                    continue

                # Skip if already pending
                if tid in self.pending_downloads:
                    continue

                # Skip if already exists in qBittorrent
                if tid in existing_mteam_ids:
                    skipped_existing += 1
                    continue

                should_dl, score, reason = self.rule_engine.evaluate_download(t)
                if should_dl:
                    candidates.append((score, t, reason))

            if skipped_existing > 0:
                logger.debug(f"Skipped {skipped_existing} torrents already in qBittorrent")

            if not candidates:
                logger.debug("No download candidates after filtering")
                return

            # Sort by score (highest first)
            candidates.sort(key=lambda x: x[0], reverse=True)

            logger.info(
                f"Download cycle: {len(candidates)} candidates, "
                f"{available_slots}/{max_tasks} slots available"
            )

            # Download top candidates without overcommitting disk capacity.
            downloaded_count = 0
            reserved_bytes = 0
            for score, torrent, reason in candidates:
                if downloaded_count >= available_slots:
                    break

                torrent_size = _torrent_size_bytes(torrent)
                if torrent_size <= 0:
                    logger.debug("Skipping %s: unknown torrent size", torrent.get("id"))
                    continue
                if reserved_bytes + torrent_size > download_budget_bytes:
                    logger.info(
                        "Skipping %s: projected download budget exceeded "
                        "(size=%s, budget_left=%s)",
                        torrent.get("id"),
                        torrent_size,
                        max(0, download_budget_bytes - reserved_bytes),
                    )
                    continue

                tid = torrent['id']
                self.pending_downloads.add(tid)
                try:
                    success = await self._download_torrent(
                        {**torrent, "_pilot_decision_reason": reason},
                        sid,
                        score,
                    )
                    if success:
                        downloaded_count += 1
                        reserved_bytes += torrent_size
                finally:
                    self.pending_downloads.discard(tid)

            if downloaded_count > 0:
                self.total_downloads += downloaded_count
                self.last_run = time.time()
                logger.info(f"Downloaded {downloaded_count} torrents in this cycle (total: {self.total_downloads})")
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
            savepath=self.config.download.save_path,
            mteam_id=tid,
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
        async with self._get_cleanup_cycle_lock():
            if not force and not self.config.cleanup.enabled:
                logger.debug("Cleanup cycle skipped: disabled")
                return

            sid = await qb_login()
            if not sid:
                logger.error("Failed to login to qBittorrent for cleanup")
                return

            tasks = await qb_get_torrents(sid)
            auto_tasks = [t for t in tasks if is_pilot_cleanup_candidate(t, self.config)]

            if not auto_tasks:
                logger.debug("No PILOT tasks to clean up")
                return

            logger.info(f"Cleanup: checking {len(auto_tasks)} PILOT tasks")
            cleanup = self.config.cleanup
            deleted_count = 0

            # Phase 1: Individual cleanup
            remaining_tasks = []
            for task in auto_tasks:
                should_delete, reason = self.rule_engine.evaluate_cleanup(task)
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

                    if cleanup.min_share_ratio > 0 and task.get('ratio', 0) < cleanup.min_share_ratio:
                        logger.debug(f"Phase2 skip (ratio protected): {task.get('name', '')[:50]}")
                        continue

                    mature_tasks.append(task)

                # Get active hashes for history cleanup
                active_hashes = {t.get('hash', '') for t in mature_tasks}
                self.cleanup_tracker.cleanup_upload_history(active_hashes)

                # Calculate sliding window speed for each task
                tasks_with_speed = []
                for task in mature_tasks:
                    avg_speed = self.cleanup_tracker.get_sliding_window_speed(
                        task,
                        window_minutes=30,
                    )
                    if avg_speed >= 0:  # Has enough data
                        task['_avg_speed_kbps'] = avg_speed
                        tasks_with_speed.append(task)
                    else:
                        # Not enough history, skip this task for now
                        logger.debug(f"Skip speed check (not enough history): {task.get('name', '')[:50]}")

                # Calculate cleanup score for each task
                for task in tasks_with_speed:
                    task['_cleanup_score'] = self.cleanup_tracker.calculate_cleanup_score(
                        task,
                        task['_avg_speed_kbps'],
                    )

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
                    still_remaining = [
                        t for t in tasks_with_speed
                        if t['_avg_speed_kbps'] >= cleanup.min_upload_speed_kbps
                    ]
                    eligible_count = len(still_remaining)
                    if eligible_count > 1:  # Keep at least one eligible task
                        to_eliminate = min(
                            eligible_count - 1,
                            max(1, int(eligible_count * cleanup.elimination_ratio / 100)),
                        )
                        # Delete from lowest score
                        for task in still_remaining[:to_eliminate]:
                            avg_speed = task['_avg_speed_kbps']
                            cleanup_score = task['_cleanup_score']
                            if await self._delete_task(task, sid, f"Bottom {cleanup.elimination_ratio}%: score={cleanup_score:.4f} ({avg_speed:.1f} KB/s)"):
                                deleted_count += 1

            if deleted_count > 0:
                self.total_cleanups += deleted_count
                self.last_run = time.time()
                logger.info(f"Cleaned {deleted_count} tasks in this cycle (total: {self.total_cleanups})")

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
        if not is_pilot_cleanup_candidate(task, self.config):
            logger.warning("Cleanup vetoed for %s: task is not isolated PILOT content", name)
            return False
        success = await qb_delete_torrent(hash_, sid, delete_files=True)
        if success:
            logger.info(f"🗑️  Deleted: {name} - {reason}")
        return success

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
    pilot_manager.loop_started_at = time.time()
    pilot_manager.mark_loop_heartbeat()

    while True:
        cycle_error: Optional[str] = None
        try:
            await pilot_manager.run_download_cycle()
            await pilot_manager.run_cleanup_cycle()
        except Exception as e:
            cycle_error = str(e)
            logger.error(f"Pilot cycle error: {e}", exc_info=True)
        finally:
            pilot_manager.mark_loop_heartbeat(error=cycle_error)

        interval = pilot_manager.config.download.interval_seconds
        pilot_manager.next_run = time.time() + interval
        await asyncio.sleep(interval)
