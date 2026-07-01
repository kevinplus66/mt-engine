import { describe, expect, it } from "vitest";
import { parsePilotConfig } from "../lib/pilot-schema";

const productionPilotConfig = {
  download: {
    enabled: true,
    max_active_tasks: 20,
    interval_seconds: 300,
    save_path: "/downloads/mt_free_farm",
    disk_usage_threshold: 90,
    rules: {
      min_size_gb: 20,
      max_size_gb: 500,
      discount_types: ["FREE", "_2X_FREE"],
      include_keywords: [],
      exclude_keywords: ["AUDIOBOOK"],
      max_seeders: 10,
      min_leechers: 100,
      prefer_scarce_upload_window: false,
      min_upload_window_score: 0,
      weight_size: -1,
      weight_free_time: 2,
      weight_age: 0.5,
      weight_seeders: 1,
    },
  },
  cleanup: {
    enabled: true,
    min_share_ratio: 0,
    min_seed_time_hours: 1,
    max_download_time_hours: 12,
    dead_seed_minutes: 30,
    dead_seed_max_ratio: 0.01,
    min_current_users: 5,
    min_upload_speed_kbps: 200,
    require_low_upload_speed_for_activity_cleanup: false,
    use_connected_peers_for_activity: false,
    allow_ratio_safe_early_cleanup: false,
    recently_cleaned_cooldown_hours: 0,
    elimination_ratio: 0,
  },
  enable_notification: true,
  cleanup_before_download: false,
};

describe("pilotConfigSchema", () => {
  it("accepts the current production PILOT config shape", () => {
    expect(parsePilotConfig(productionPilotConfig)).toEqual(productionPilotConfig);
  });

  it("rejects unsafe low download intervals", () => {
    expect(() =>
      parsePilotConfig({
        ...productionPilotConfig,
        download: {
          ...productionPilotConfig.download,
          interval_seconds: 30,
        },
      })
    ).toThrow(/interval_seconds/);
  });

  it("rejects an empty save path", () => {
    expect(() =>
      parsePilotConfig({
        ...productionPilotConfig,
        download: {
          ...productionPilotConfig.download,
          save_path: "",
        },
      })
    ).toThrow(/save_path/);
  });
});
