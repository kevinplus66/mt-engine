"""
Pilot configuration persistence and migration helpers.
"""

import json
import os
from pathlib import Path

from app.config import logger
from app.models import AutomationConfig, normalize_download_save_path

CONFIG_PATH = Path("/app/data/pilot.json")
DATA_DIR = Path("/app/data")


def ensure_pilot_data_directory() -> None:
    """Check/create data directory with warning for Docker mount."""
    if not DATA_DIR.exists():
        logger.warning(
            "⚠️  /app/data directory not found! "
            "Please ensure docker-compose.yml mounts './data:/app/data' "
            "to persist configuration across restarts."
        )
        DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_pilot_config() -> AutomationConfig:
    """Load config from JSON file or return defaults."""
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH) as f:
                data = json.load(f)

            _migrate_pilot_config(data)
            logger.info("Loaded pilot config from file")
            config = AutomationConfig(**data)
        except Exception as e:
            logger.error(f"Failed to load pilot config: {e}")
            config = AutomationConfig()
    else:
        logger.info("Using default pilot config")
        config = AutomationConfig()

    env_save_path = os.getenv("PILOT_SAVE_PATH")
    if env_save_path and not env_save_path.isspace():
        config.download.save_path = normalize_download_save_path(env_save_path)
        logger.info(f"Overriding save_path from env: {config.download.save_path}")

    return config


def save_pilot_config(config: AutomationConfig) -> None:
    """Persist config to JSON (no credentials)."""
    try:
        validated_config = AutomationConfig.model_validate(config.model_dump())
        CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(CONFIG_PATH, "w") as f:
            json.dump(validated_config.model_dump(), f, indent=2)
        logger.info("Saved pilot config to file")
    except Exception as e:
        logger.error(f"Failed to save pilot config: {e}")


def _migrate_pilot_config(data: dict) -> None:
    if "cleanup" in data and "max_pilot_tasks_ratio" in data["cleanup"]:
        old_ratio = data["cleanup"]["max_pilot_tasks_ratio"]
        del data["cleanup"]["max_pilot_tasks_ratio"]
        logger.info(
            "Migrated config: removed max_pilot_tasks_ratio=%s, "
            "will use elimination_ratio default",
            old_ratio,
        )

    if "download" in data:
        disk_val = data["download"].get("disk_usage_threshold")
        if disk_val is not None and disk_val <= 1:
            data["download"]["disk_usage_threshold"] = int(disk_val * 100)
            logger.info(
                "Migrated disk_usage_threshold: %s -> %s",
                disk_val,
                data["download"]["disk_usage_threshold"],
            )

        rules = data["download"].get("rules")
        if isinstance(rules, dict):
            if rules.get("weight_free_time") == 2.0 and rules.get("weight_seeders") == 1.0:
                rules["weight_free_time"] = 0.4
                rules["weight_seeders"] = 3.0
                logger.info(
                    "Migrated pilot scoring weights to demand-led defaults "
                    "(weight_free_time=0.4, weight_seeders=3.0)"
                )

    if "cleanup" in data:
        elim_val = data["cleanup"].get("elimination_ratio")
        if elim_val is not None and elim_val <= 1:
            data["cleanup"]["elimination_ratio"] = int(elim_val * 100)
            logger.info(
                "Migrated elimination_ratio: %s -> %s",
                elim_val,
                data["cleanup"]["elimination_ratio"],
            )
