from contextlib import closing

import sqlite3

import pytest

from app.services import panel_db


@pytest.fixture()
def temp_panel_db(tmp_path, monkeypatch):
    db_path = tmp_path / "panel.db"
    monkeypatch.setattr(panel_db, "DB_PATH", db_path)
    panel_db.init_database()
    return db_path


def _connect(db_path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def test_init_database_creates_source_timestamp_index(temp_panel_db):
    with closing(_connect(temp_panel_db)) as conn:
        indexes = conn.execute("PRAGMA index_list('traffic_stats')").fetchall()
        assert "idx_traffic_source_time" in {row["name"] for row in indexes}

        columns = conn.execute(
            "PRAGMA index_info('idx_traffic_source_time')"
        ).fetchall()
        assert [row["name"] for row in columns] == ["source", "timestamp"]


@pytest.mark.asyncio
async def test_save_panel_stats_batch_writes_all_samples(temp_panel_db):
    ok = await panel_db.save_panel_stats_batch(
        timestamp=1_700_000_000,
        qb_traffic={
            "uploaded": 100,
            "downloaded": 200,
            "upload_speed": 3,
            "download_speed": 4,
        },
        mteam_traffic={
            "uploaded": 500,
            "downloaded": 600,
        },
        user_stats={
            "share_ratio": 1.5,
            "uploaded": 500,
            "downloaded": 600,
            "bonus": 42,
            "seeding_count": 7,
            "leeching_count": 2,
            "user_level": "power",
        },
    )

    assert ok is True
    with closing(_connect(temp_panel_db)) as conn:
        traffic_rows = conn.execute(
            """
            SELECT source, timestamp, uploaded, downloaded, upload_speed, download_speed
            FROM traffic_stats
            ORDER BY source
            """
        ).fetchall()
        user_rows = conn.execute(
            """
            SELECT timestamp, share_ratio, uploaded, downloaded, bonus,
                   seeding_count, leeching_count, user_level
            FROM user_stats
            """
        ).fetchall()

    traffic = {row["source"]: dict(row) for row in traffic_rows}
    assert traffic == {
        "mteam": {
            "source": "mteam",
            "timestamp": 1_700_000_000,
            "uploaded": 500,
            "downloaded": 600,
            "upload_speed": None,
            "download_speed": None,
        },
        "qbittorrent": {
            "source": "qbittorrent",
            "timestamp": 1_700_000_000,
            "uploaded": 100,
            "downloaded": 200,
            "upload_speed": 3,
            "download_speed": 4,
        },
    }
    assert [dict(row) for row in user_rows] == [
        {
            "timestamp": 1_700_000_000,
            "share_ratio": 1.5,
            "uploaded": 500,
            "downloaded": 600,
            "bonus": 42,
            "seeding_count": 7,
            "leeching_count": 2,
            "user_level": "power",
        }
    ]


@pytest.mark.asyncio
async def test_save_panel_stats_batch_rolls_back_malformed_batch(temp_panel_db):
    ok = await panel_db.save_panel_stats_batch(
        timestamp=1_700_000_001,
        qb_traffic={
            "uploaded": 100,
            "downloaded": 200,
            "upload_speed": 3,
            "download_speed": 4,
        },
        mteam_traffic={
            "uploaded": 500,
            "downloaded": 600,
        },
        user_stats={
            "share_ratio": None,
            "uploaded": 500,
            "downloaded": 600,
        },
    )

    assert ok is False
    with closing(_connect(temp_panel_db)) as conn:
        assert conn.execute("SELECT COUNT(*) FROM traffic_stats").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM user_stats").fetchone()[0] == 0
