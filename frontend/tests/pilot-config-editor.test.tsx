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

function setupEditor(
  saveConfig = vi
    .fn<(config: AutomationConfig) => Promise<void>>()
    .mockResolvedValue(undefined),
) {
  const hook = renderHook(() =>
    usePilotConfigEditor({
      config: savedConfig,
      saveConfig,
    }),
  );

  return { ...hook, saveConfig };
}

describe("usePilotConfigEditor toggle persistence", () => {
  it("saves the download enabled change on top of the latest draft config", async () => {
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
        save_path: "/draft-path",
      },
    });
    expect(saveConfig.mock.calls[0]?.[0].download.save_path).toBe("/draft-path");
    expect(result.current.editedConfig?.download.enabled).toBe(false);
    expect(result.current.editedConfig?.download.save_path).toBe("/draft-path");
  });

  it("saves the cleanup enabled change on top of the latest draft config", async () => {
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
        min_share_ratio: 8,
      },
    });
    expect(saveConfig.mock.calls[0]?.[0].cleanup.min_share_ratio).toBe(8);
    expect(result.current.editedConfig?.cleanup.enabled).toBe(false);
    expect(result.current.editedConfig?.cleanup.min_share_ratio).toBe(8);
  });

  it("uses the fixed current draft after an invalid quick save", async () => {
    const { result, saveConfig } = setupEditor();
    await waitFor(() => expect(result.current.editedConfig).toEqual(savedConfig));

    const invalidDraft = {
      ...savedConfig,
      download: {
        ...savedConfig.download,
        save_path: "",
      },
    };

    act(() => {
      result.current.handleConfigChange(invalidDraft, "save-path");
    });

    await act(async () => {
      await result.current.handleDownloadToggle(false);
    });

    expect(saveConfig).not.toHaveBeenCalled();
    expect(result.current.validationErrors["save-path"]).toBe("保存路径不能为空");

    const failedDraft = result.current.editedConfig;
    if (!failedDraft) throw new Error("missing edited config");
    const fixedDraft = {
      ...failedDraft,
      download: {
        ...failedDraft.download,
        save_path: "/fixed-path",
      },
    };

    act(() => {
      result.current.handleConfigChange(fixedDraft, "save-path");
    });

    await act(async () => {
      await result.current.handleCleanupToggle(false);
    });

    expect(saveConfig).toHaveBeenCalledTimes(1);
    expect(saveConfig).toHaveBeenCalledWith({
      ...savedConfig,
      download: {
        ...savedConfig.download,
        enabled: false,
        save_path: "/fixed-path",
      },
      cleanup: {
        ...savedConfig.cleanup,
        enabled: false,
      },
    });
  });

  it("serializes rapid quick toggles so both persisted changes survive", async () => {
    const saveResolvers: Array<() => void> = [];
    const saveConfig = vi.fn<(config: AutomationConfig) => Promise<void>>(
      () =>
        new Promise<void>((resolve) => {
          saveResolvers.push(resolve);
        }),
    );
    const { result } = setupEditor(saveConfig);
    await waitFor(() => expect(result.current.editedConfig).toEqual(savedConfig));

    let downloadSave: Promise<void> | undefined;
    let cleanupSave: Promise<void> | undefined;
    act(() => {
      downloadSave = result.current.handleDownloadToggle(false);
      cleanupSave = result.current.handleCleanupToggle(false);
    });

    await waitFor(() => expect(saveConfig).toHaveBeenCalledTimes(1));
    expect(saveConfig.mock.calls[0]?.[0]).toEqual({
      ...savedConfig,
      download: {
        ...savedConfig.download,
        enabled: false,
      },
    });

    await act(async () => {
      saveResolvers[0]?.();
      await downloadSave;
    });

    await waitFor(() => expect(saveConfig).toHaveBeenCalledTimes(2));
    expect(saveConfig.mock.calls[1]?.[0]).toEqual({
      ...savedConfig,
      download: {
        ...savedConfig.download,
        enabled: false,
      },
      cleanup: {
        ...savedConfig.cleanup,
        enabled: false,
      },
    });

    let downloadRestore: Promise<void> | undefined;
    act(() => {
      downloadRestore = result.current.handleDownloadToggle(true);
    });
    expect(saveConfig).toHaveBeenCalledTimes(2);

    await act(async () => {
      saveResolvers[1]?.();
      await cleanupSave;
    });

    await waitFor(() => expect(saveConfig).toHaveBeenCalledTimes(3));
    expect(saveConfig.mock.calls[2]?.[0]).toEqual({
      ...savedConfig,
      download: {
        ...savedConfig.download,
        enabled: true,
      },
      cleanup: {
        ...savedConfig.cleanup,
        enabled: false,
      },
    });

    await act(async () => {
      saveResolvers[2]?.();
      await downloadRestore;
    });

    expect(result.current.editedConfig?.download.enabled).toBe(true);
    expect(result.current.editedConfig?.cleanup.enabled).toBe(false);
  });
});
