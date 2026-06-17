import json

import pytest

from app.core import pilot_config_store
from app.models import AutomationConfig
from app.routes import pilot as pilot_routes


@pytest.mark.asyncio
async def test_update_config_persists_and_rebuilds_rule_engine(tmp_path):
    config_path = tmp_path / "pilot.json"
    original_config_path = pilot_config_store.CONFIG_PATH
    original_config = pilot_routes.pilot_manager.config
    original_rule_engine = pilot_routes.pilot_manager.rule_engine

    new_config = AutomationConfig()
    new_config.download.enabled = False
    new_config.download.max_active_tasks = 7
    new_config.download.interval_seconds = 180
    new_config.download.save_path = "/downloads/pilot-test"
    new_config.download.rules.min_size_gb = 12.5
    new_config.download.rules.include_keywords = ["remux", "uhd"]
    new_config.cleanup.enabled = False
    new_config.cleanup.min_share_ratio = 1.5
    new_config.enable_notification = False

    try:
        pilot_config_store.CONFIG_PATH = config_path

        response = await pilot_routes.update_config(new_config)

        assert response == {
            "status": "ok",
            "message": "Configuration updated successfully",
        }
        assert json.loads(config_path.read_text(encoding="utf-8")) == new_config.model_dump()
        assert pilot_routes.pilot_manager.config == new_config
        assert pilot_routes.pilot_manager.rule_engine is not original_rule_engine
        assert pilot_routes.pilot_manager.rule_engine.config == new_config
        assert pilot_routes.pilot_manager.rule_engine.config is pilot_routes.pilot_manager.config
    finally:
        pilot_config_store.CONFIG_PATH = original_config_path
        pilot_routes.pilot_manager.config = original_config
        pilot_routes.pilot_manager.rule_engine = original_rule_engine
