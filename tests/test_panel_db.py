import os
import sqlite3
import time
from contextlib import closing

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


@pytest.mark.asyncio
async def test_get_latest_stats_uses_latest_row_per_source(temp_panel_db):
    with closing(_connect(temp_panel_db)) as conn:
        conn.executemany(
            """
            INSERT INTO traffic_stats
            (timestamp, source, uploaded, downloaded, upload_speed, download_speed)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            [
                (100, "mteam", 500, 600, None, None),
                (100, "qbittorrent", 100, 200, 1, 2),
                (200, "qbittorrent", 150, 250, 3, 4),
            ],
        )
        conn.execute(
            """
            INSERT INTO user_stats
            (timestamp, share_ratio, uploaded, downloaded)
            VALUES (?, ?, ?, ?)
            """,
            (150, 1.5, 500, 600),
        )
        conn.commit()

    latest = await panel_db.get_latest_stats()

    assert latest["mteam"]["uploaded"] == 500
    assert latest["mteam"]["timestamp"] == 100
    assert latest["qbittorrent"]["uploaded"] == 150
    assert latest["qbittorrent"]["timestamp"] == 200
    assert latest["user"]["timestamp"] == 150
    assert latest["last_update"] == 200


def test_get_traffic_history_carries_forward_partial_samples(temp_panel_db):
    now = int(time.time())
    before_range = now - 7200
    first = now - 1800
    second = now - 1200
    with closing(_connect(temp_panel_db)) as conn:
        conn.executemany(
            """
            INSERT INTO traffic_stats
            (timestamp, source, uploaded, downloaded)
            VALUES (?, ?, ?, ?)
            """,
            [
                (before_range, "mteam", 500, 600),
                (before_range, "qbittorrent", 100, 200),
                (first, "qbittorrent", 150, 250),
                (second, "mteam", 550, 650),
            ],
        )
        conn.commit()

    points = panel_db.get_traffic_history(1)

    assert points == [
        {
            "timestamp": first,
            "mteam": {"uploaded": 500, "downloaded": 600},
            "qbittorrent": {"uploaded": 150, "downloaded": 250},
        },
        {
            "timestamp": second,
            "mteam": {"uploaded": 550, "downloaded": 650},
            "qbittorrent": {"uploaded": 150, "downloaded": 250},
        },
    ]


def test_get_share_ratio_history_uses_24h_baseline_for_short_range(temp_panel_db):
    if not hasattr(time, "tzset"):
        pytest.skip("time.tzset is required to exercise local timezone handling")

    previous_tz = os.environ.get("TZ")
    os.environ["TZ"] = "Asia/Shanghai"
    time.tzset()
    try:
        now = int(time.time())
        older_baseline = now - 30 * 3600
        baseline = now - 24 * 3600
        current = now
        with closing(_connect(temp_panel_db)) as conn:
            conn.executemany(
                """
                INSERT INTO user_stats
                (timestamp, share_ratio, uploaded, downloaded)
                VALUES (?, ?, ?, ?)
                """,
                [
                    (older_baseline, 1.00, 100, 100),
                    (baseline, 1.25, 125, 100),
                    (current, 1.75, 200, 100),
                ],
            )
            conn.commit()

        points, stats = panel_db.get_share_ratio_history(1)
    finally:
        if previous_tz is None:
            os.environ.pop("TZ", None)
        else:
            os.environ["TZ"] = previous_tz
        time.tzset()

    assert points == [{"timestamp": current, "share_ratio": 1.75}]
    assert stats == {
        "current": 1.75,
        "highest": 1.75,
        "lowest": 1.75,
        "change_24h": 0.5,
    }
