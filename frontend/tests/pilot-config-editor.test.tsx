import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePilotConfigEditor } from "../hooks/use-pilot-config-editor";
import type { AutomationConfig } from "../lib/types";

vi.mock("@/lib/toast", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

const savedConfig: AutomationConfig = {
  download: {
    enabled: true,
    max_active_tasks: 3,
    interval_seconds: 300,
    save_path: "/downloads",
    disk_usage_threshold: 80,
    rules: {
      min_size_gb: 1,
      max_size_gb: 50,
      discount_types: ["FREE"],
      include_keywords: ["linux"],
      exclude_keywords: ["cam"],
      max_seeders: 20,
      min_leechers: 0,
      weight_size: 1,
      weight_free_time: 2,
      weight_age: -1,
      weight_seeders: -2,
    },
  },
  cleanup: {
    enabled: true,
    min_share_ratio: 2,
    min_seed_time_hours: 72,
    max_download_time_hours: 48,
    dead_seed_minutes: 30,
    dead_seed_max_ratio: 0.2,
    min_current_users: 1,
    min_upload_speed_kbps: 16,
    elimination_ratio: 10,
  },
  enable_notification: true,
};

function setupEditor() {
  const saveConfig = vi.fn<(config: AutomationConfig) => Promise<void>>().mockResolvedValue(undefined);
  const hook = renderHook(() =>
    usePilotConfigEditor({
      config: savedConfig,
      saveConfig,
    }),
  );

  return { ...hook, saveConfig };
}

describe("usePilotConfigEditor toggle persistence", () => {
  it("saves only the download enabled change while preserving draft download fields locally", async () => {
    const { result, saveConfig } = setupEditor();
    await waitFor(() => expect(result.current.editedConfig).toEqual(savedConfig));

    const draftConfig = {
      ...savedConfig,
      download: {
        ...savedConfig.download,
        save_path: "/draft-path",
      },
    };

    act(() => {
      result.current.handleConfigChange(draftConfig, "save-path");
    });

    await act(async () => {
      await result.current.handleDownloadToggle(false);
    });

    expect(saveConfig).toHaveBeenCalledTimes(1);
    expect(saveConfig).toHaveBeenCalledWith({
      ...savedConfig,
      download: {
        ...savedConfig.download,
        enabled: false,
      },
    });
    expect(saveConfig.mock.calls[0]?.[0].download.save_path).toBe("/downloads");
    expect(result.current.editedConfig?.download.enabled).toBe(false);
    expect(result.current.editedConfig?.download.save_path).toBe("/draft-path");
  });

  it("saves only the cleanup enabled change while preserving draft cleanup fields locally", async () => {
    const { result, saveConfig } = setupEditor();
    await waitFor(() => expect(result.current.editedConfig).toEqual(savedConfig));

    const draftConfig = {
      ...savedConfig,
      cleanup: {
        ...savedConfig.cleanup,
        min_share_ratio: 8,
      },
    };

    act(() => {
      result.current.handleConfigChange(draftConfig, "min-ratio");
    });

    await act(async () => {
      await result.current.handleCleanupToggle(false);
    });

    expect(saveConfig).toHaveBeenCalledTimes(1);
    expect(saveConfig).toHaveBeenCalledWith({
      ...savedConfig,
      cleanup: {
        ...savedConfig.cleanup,
        enabled: false,
      },
    });
    expect(saveConfig.mock.calls[0]?.[0].cleanup.min_share_ratio).toBe(2);
    expect(result.current.editedConfig?.cleanup.enabled).toBe(false);
    expect(result.current.editedConfig?.cleanup.min_share_ratio).toBe(8);
  });
});
