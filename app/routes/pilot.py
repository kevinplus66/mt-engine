"""
Pilot API endpoints (领航)
"""
from fastapi import APIRouter, HTTPException, status

from app.models import AutomationConfig
from app.core.pilot import has_pilot_tag, is_pilot_cleanup_candidate, pilot_manager
from app.core.pilot_disk import DownloadDiskError
from app.core.pilot_config_store import save_pilot_config
from app.core.rules import RuleEngine
from app.services.qbittorrent import qb_login, qb_get_torrents, qb_get_existing_mteam_ids
from app.config import logger
import app.state as state


# Router
router = APIRouter(
    prefix="/api/pilot"
)


@router.get("/config")
async def get_config():
    """
    Get current pilot configuration

    Returns:
        dict: Current configuration
    """
    return pilot_manager.config.model_dump()


@router.post("/config")
async def update_config(config: AutomationConfig):
    """
    Update pilot configuration

    Args:
        config: New configuration

    Returns:
        dict: Status message
    """
    pilot_manager.config = config
    pilot_manager.rule_engine = RuleEngine(config)
    save_pilot_config(pilot_manager.config)
    logger.info("Pilot config updated via API")
    return {"status": "ok", "message": "Configuration updated successfully"}


@router.get("/stats")
async def get_stats():
    """
    Get pilot statistics

    Returns:
        dict: Current stats (active tasks, pending downloads, disk usage, totals, run times)
    """
    sid = await qb_login()
    tasks = await qb_get_torrents(sid) if sid else []
    auto_tasks = [t for t in tasks if has_pilot_tag(t.get('tags', ''))]

    return {
        "active_tasks": len(auto_tasks),
        "pending_downloads": len(pilot_manager.pending_downloads),
        "download_enabled": pilot_manager.config.download.enabled,
        "cleanup_enabled": pilot_manager.config.cleanup.enabled,
        "interval_seconds": pilot_manager.config.download.interval_seconds,
        "total_downloads": pilot_manager.total_downloads,
        "total_cleanups": pilot_manager.total_cleanups,
        "disk_usage_percent": pilot_manager.get_disk_usage_percent(),
        "last_run": pilot_manager.last_run,
        "next_run": pilot_manager.next_run,
        "is_running": pilot_manager.is_running_healthy(),
    }


@router.get("/dry-run")
async def dry_run():
    """
    Simulate run - returns what would be downloaded/cleaned

    Returns:
        dict: Download candidates and cleanup candidates
    """
    # Get download candidates
    torrents = state.cached_data.get('torrents', [])
    download_candidates = []

    # Login to get existing IDs
    sid = await qb_login()
    existing_mteam_ids = await qb_get_existing_mteam_ids(sid) if sid else set()
    tasks = await qb_get_torrents(sid) if sid else []
    cleanup_tasks = [t for t in tasks if is_pilot_cleanup_candidate(t, pilot_manager.config)]
    download_budget_error = None
    try:
        download_budget_bytes = max(0, pilot_manager._get_download_capacity_budget_bytes(tasks))
    except DownloadDiskError as e:
        download_budget_error = str(e)
        download_budget_bytes = 0
    torrent_sizes = {str(t.get('id', '')): int(t.get('size') or 0) for t in torrents}

    skipped_existing = 0
    for t in torrents:
        tid = t.get('id', '')
        if tid in pilot_manager.pending_downloads:
            continue

        # Skip if already exists in qBittorrent
        if tid in existing_mteam_ids:
            skipped_existing += 1
            continue

        should_dl, score, reason = pilot_manager.rule_engine.evaluate_download(t)
        if should_dl:
            download_candidates.append({
                "id": tid,
                "name": t.get('name', ''),
                "size_gb": round(t.get('size', 0) / (1000**3), 2),  # Decimal (1000) to match backend format_size
                "score": score,
                "reason": reason
            })

    # Sort by score and apply the same disk-budget reservation used by real downloads.
    download_candidates.sort(key=lambda x: x['score'], reverse=True)
    budgeted_download_candidates = []
    reserved_bytes = 0
    skipped_budget = 0
    for candidate in download_candidates:
        torrent_size = torrent_sizes.get(str(candidate["id"]), 0)
        if download_budget_error is None and (
            torrent_size <= 0 or reserved_bytes + torrent_size <= download_budget_bytes
        ):
            budgeted_download_candidates.append(candidate)
            reserved_bytes += torrent_size
        else:
            skipped_budget += 1
    download_candidates = budgeted_download_candidates

    # Get cleanup candidates. Phase 1 mirrors direct per-task cleanup; Phase 2
    # previews the real sliding-window upload-speed eliminator without recording
    # a new sample.
    cleanup_candidates = []
    remaining_cleanup_tasks = []

    for task in cleanup_tasks:
        should_delete, reason = pilot_manager.rule_engine.evaluate_cleanup(task)
        if should_delete:
            cleanup_candidates.append({
                "name": task.get('name', ''),
                "hash": task.get('hash', ''),
                "ratio": round(task.get('ratio', 0), 2),
                "reason": reason
            })
        else:
            remaining_cleanup_tasks.append(task)

    cleanup = pilot_manager.config.cleanup
    for task in remaining_cleanup_tasks:
        if task.get('progress', 0) < 1.0:
            continue
        if task.get('seeding_time', 0) / 3600 < cleanup.min_seed_time_hours:
            continue
        if cleanup.min_share_ratio > 0 and task.get('ratio', 0) < cleanup.min_share_ratio:
            continue

        avg_speed = pilot_manager.cleanup_tracker.get_sliding_window_speed(
            task,
            window_minutes=30,
            record=False,
        )
        if 0 <= avg_speed < cleanup.min_upload_speed_kbps:
            cleanup_candidates.append({
                "name": task.get('name', ''),
                "hash": task.get('hash', ''),
                "ratio": round(task.get('ratio', 0), 2),
                "avg_speed_kbps": round(avg_speed, 1),
                "reason": f"Low speed: {avg_speed:.1f} KB/s (30min avg)",
                "phase": "speed",
            })

    return {
        "download_candidates": download_candidates[:20],  # Top 20
        "total_download_candidates": len(download_candidates),
        "download_budget_bytes": download_budget_bytes,
        "skipped_budget": skipped_budget,
        "download_budget_error": download_budget_error,
        "cleanup_candidates": cleanup_candidates,
        "total_cleanup_candidates": len(cleanup_candidates),
        "skipped_existing": skipped_existing,  # 新增：显示跳过的已存在种子数
    }


@router.post("/run-download")
async def trigger_download():
    """
    Manually trigger download cycle

    Returns:
        dict: Status message
    """
    logger.info("Manual download cycle triggered via API")
    try:
        await pilot_manager.run_download_cycle(force=True)
        return {"status": "completed", "message": "Download cycle completed"}
    except Exception as e:
        logger.error(f"Manual download cycle failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Download cycle failed: {str(e)}"
        )


@router.post("/run-cleanup")
async def trigger_cleanup():
    """
    Manually trigger cleanup cycle

    Returns:
        dict: Status message
    """
    logger.info("Manual cleanup cycle triggered via API")
    try:
        await pilot_manager.run_cleanup_cycle(force=True)
        return {"status": "completed", "message": "Cleanup cycle completed"}
    except Exception as e:
        logger.error(f"Manual cleanup cycle failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cleanup cycle failed: {str(e)}"
        )
