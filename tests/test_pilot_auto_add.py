import pytest

from app.core import pilot as pilot_core
from app.models import AutomationConfig


VALID_SAVE_PATH = "/downloads/pilot-auto-add"

def _manager() -> pilot_core.PilotManager:
    manager = pilot_core.PilotManager()
    manager.config = AutomationConfig.model_validate(
        {"download": {"save_path": VALID_SAVE_PATH}}
    )
    return manager


@pytest.mark.asyncio
async def test_download_torrent_adds_downloaded_file_to_qbittorrent(monkeypatch):
    torrent_bytes = b"d8:announce13:http://tracker4:infoe"
    added = []
    download_calls = []

    async def fake_download_torrent_file(tid):
        download_calls.append(tid)
        assert tid == "torrent-123"
        return torrent_bytes

    async def fake_qb_add_torrent_file(content, sid, *, tag=None, savepath=None, mteam_id=None):
        added.append(
            {
                "content": content,
                "sid": sid,
                "tag": tag,
                "savepath": savepath,
                "mteam_id": mteam_id,
            }
        )
        return True


    monkeypatch.setattr(pilot_core, "download_torrent_file", fake_download_torrent_file)
    monkeypatch.setattr(pilot_core, "qb_add_torrent_file", fake_qb_add_torrent_file)

    manager = _manager()
    expected_save_path = manager.config.download.save_path
    assert expected_save_path == VALID_SAVE_PATH
    result = await manager._download_torrent(
        {
            "id": "torrent-123",
            "hash": "hash-123",
            "name": "Free Torrent",
            "size": 123456,
            "discount": "FREE",
            "seeders": 7,
            "leechers": 19,
            "score_components": {"demand": 0.9},
            "_pilot_decision_reason": "Score: 0.75",
        },
        "qb-sid",
        0.75,
    )

    assert result is True
    assert added == [
        {
            "content": torrent_bytes,
            "sid": "qb-sid",
            "tag": "PILOT",
            "savepath": expected_save_path,
            "mteam_id": "torrent-123",
        }
    ]
    assert download_calls == ["torrent-123"]


@pytest.mark.asyncio
@pytest.mark.parametrize("torrent_content", [b"", None], ids=["empty-bytes", "none"])
async def test_download_torrent_rejects_missing_torrent_file(monkeypatch, torrent_content):
    added = []

    async def fake_download_torrent_file(tid):
        assert tid == "missing-torrent"
        return torrent_content

    async def fake_qb_add_torrent_file(*args, **kwargs):
        added.append((args, kwargs))

    monkeypatch.setattr(pilot_core, "download_torrent_file", fake_download_torrent_file)
    monkeypatch.setattr(pilot_core, "qb_add_torrent_file", fake_qb_add_torrent_file)

    manager = _manager()
    result = await manager._download_torrent(
        {"id": "missing-torrent", "name": "Missing Torrent"}, "qb-sid", 0.25
    )

    assert result is False
    assert added == []
