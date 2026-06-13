"""
In-process runtime dependency status.
"""

from dataclasses import asdict
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Union

from app.config import BEIJING_TZ


@dataclass
class DependencyStatus:
    name: str
    ok: bool = False
    last_success: Optional[str] = None
    last_error: Optional[str] = None


class RuntimeStatus:
    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.qbittorrent = DependencyStatus(name="qbittorrent")
        self.mteam = DependencyStatus(name="mteam")

    def mark_success(self, name: str) -> None:
        target = getattr(self, name)
        target.ok = True
        target.last_success = datetime.now(BEIJING_TZ).isoformat()
        target.last_error = None

    def mark_error(self, name: str, error: Union[Exception, str]) -> None:
        target = getattr(self, name)
        target.ok = False
        target.last_error = str(error)

    def as_dict(self) -> dict:
        return {
            "qbittorrent": asdict(self.qbittorrent),
            "mteam": asdict(self.mteam),
        }


runtime_status = RuntimeStatus()
