"""
Pilot cleanup scoring and upload-speed tracking.
"""

import time
from typing import Dict, List, Tuple


class PilotCleanupTracker:
    """Tracks upload history and computes cleanup scores."""

    def __init__(self):
        self.upload_history: Dict[str, List[Tuple[float, int]]] = {}


    def get_sliding_window_speed(
        self,
        task: dict,
        window_minutes: int = 30,
        *,
        record: bool = True,
    ) -> float:
        """
        Calculate average upload speed over the last N minutes.

        Returns KB/s, or -1 when there is not enough history yet.
        """
        hash_ = task.get("hash", "")
        current_uploaded = task.get("uploaded", 0)
        current_time = time.time()

        history = self.upload_history.get(hash_, [])
        samples = [*history, (current_time, current_uploaded)]

        cutoff = current_time - (window_minutes * 60)
        samples = [
            (timestamp, uploaded)
            for timestamp, uploaded in samples
            if timestamp >= cutoff
        ]

        if record:
            self.upload_history[hash_] = samples

        if len(samples) < 2:
            return -1

        oldest_time, oldest_uploaded = samples[0]
        time_delta = current_time - oldest_time
        if time_delta <= 0:
            return -1

        uploaded_delta = current_uploaded - oldest_uploaded
        if uploaded_delta < 0:
            return 0

        return (uploaded_delta / time_delta) / 1024

    def cleanup_upload_history(self, active_hashes: set):
        """Remove history for tasks that no longer exist."""
        self.upload_history = {
            hash_: data
            for hash_, data in self.upload_history.items()
            if hash_ in active_hashes
        }

    @staticmethod
    def calculate_cleanup_score(task: dict, avg_speed_kbps: float) -> float:
        """
        Calculate cleanup score; higher scores mean the task should be kept.
        """
        speed_score = min(avg_speed_kbps / 1000, 1.0)

        seeders = max(0, task.get("num_complete", 0))
        leechers = max(0, task.get("num_incomplete", 0))
        scarcity_score = 1 / (1 + seeders / 10)
        demand_gap_score = min(max(leechers - seeders, 0), 200) / 200

        total = 0.65 * speed_score + 0.2 * scarcity_score + 0.15 * demand_gap_score
        return round(total, 4)
