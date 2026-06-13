import type { AutomationConfig } from "@/lib/types";

export type ConfigValidationErrors = Partial<Record<string, string>>;

export const INITIAL_CONFIG_SECTIONS = ["download-settings"];

const CONFIG_FIELD_ORDER = [
  "max-tasks",
  "interval",
  "disk-threshold",
  "save-path",
  "min-size",
  "max-size",
  "max-seeders",
  "min-leechers",
  "weight-size",
  "weight-free-time",
  "weight-age",
  "weight-seeders",
  "min-ratio",
  "min-seed-time",
  "max-download-time",
  "dead-seed-minutes",
  "dead-seed-ratio",
  "min-current-users",
  "min-upload-speed",
  "elimination-ratio",
] as const;

type ConfigFieldId = (typeof CONFIG_FIELD_ORDER)[number];

const CONFIG_FIELD_SECTION: Record<ConfigFieldId, string> = {
  "max-tasks": "download-settings",
  interval: "download-settings",
  "disk-threshold": "download-settings",
  "save-path": "download-settings",
  "min-size": "download-rules",
  "max-size": "download-rules",
  "max-seeders": "download-rules",
  "min-leechers": "download-rules",
  "weight-size": "download-rules",
  "weight-free-time": "download-rules",
  "weight-age": "download-rules",
  "weight-seeders": "download-rules",
  "min-ratio": "cleanup-rules",
  "min-seed-time": "cleanup-rules",
  "max-download-time": "cleanup-rules",
  "dead-seed-minutes": "cleanup-rules",
  "dead-seed-ratio": "cleanup-rules",
  "min-current-users": "cleanup-rules",
  "min-upload-speed": "cleanup-rules",
  "elimination-ratio": "cleanup-rules",
};

function setNumericError(
  errors: ConfigValidationErrors,
  fieldId: ConfigFieldId,
  value: number,
  options: {
    min?: number;
    max?: number;
    integer?: boolean;
  },
) {
  if (!Number.isFinite(value)) {
    errors[fieldId] = "请输入有效数字";
    return;
  }

  if (options.integer && !Number.isInteger(value)) {
    errors[fieldId] = "请输入整数";
    return;
  }

  if (options.min !== undefined && value < options.min) {
    errors[fieldId] = `不能小于 ${options.min}`;
    return;
  }

  if (options.max !== undefined && value > options.max) {
    errors[fieldId] = `不能大于 ${options.max}`;
  }
}

export function arePilotConfigsEqual(
  left: AutomationConfig | null,
  right: AutomationConfig | null,
) {
  if (!left || !right) return false;
  return JSON.stringify(left) === JSON.stringify(right);
}

export function validateAutomationConfig(config: AutomationConfig) {
  const errors: ConfigValidationErrors = {};
  const { download, cleanup } = config;
  const { rules } = download;

  setNumericError(errors, "max-tasks", download.max_active_tasks, {
    min: 1,
    max: 50,
    integer: true,
  });
  setNumericError(errors, "interval", download.interval_seconds, {
    min: 60,
    integer: true,
  });
  setNumericError(errors, "disk-threshold", download.disk_usage_threshold, {
    min: 50,
    max: 95,
    integer: true,
  });
  if (download.save_path.trim().length === 0) {
    errors["save-path"] = "保存路径不能为空";
  }

  setNumericError(errors, "min-size", rules.min_size_gb, { min: 0 });
  setNumericError(errors, "max-size", rules.max_size_gb, { min: 0 });
  if (
    !errors["min-size"] &&
    !errors["max-size"] &&
    rules.max_size_gb < rules.min_size_gb
  ) {
    errors["max-size"] = "最大体积不能小于最小体积";
  }
  setNumericError(errors, "max-seeders", rules.max_seeders, {
    min: 0,
    integer: true,
  });
  setNumericError(errors, "min-leechers", rules.min_leechers, {
    min: 0,
    integer: true,
  });
  setNumericError(errors, "weight-size", rules.weight_size, {
    min: -10,
    max: 10,
  });
  setNumericError(errors, "weight-free-time", rules.weight_free_time, {
    min: -10,
    max: 10,
  });
  setNumericError(errors, "weight-age", rules.weight_age, {
    min: -10,
    max: 10,
  });
  setNumericError(errors, "weight-seeders", rules.weight_seeders, {
    min: -10,
    max: 10,
  });

  setNumericError(errors, "min-ratio", cleanup.min_share_ratio, { min: 0 });
  setNumericError(errors, "min-seed-time", cleanup.min_seed_time_hours, {
    min: 0,
    integer: true,
  });
  setNumericError(
    errors,
    "max-download-time",
    cleanup.max_download_time_hours,
    { min: 0, integer: true },
  );
  setNumericError(errors, "dead-seed-minutes", cleanup.dead_seed_minutes, {
    min: 5,
    integer: true,
  });
  setNumericError(errors, "dead-seed-ratio", cleanup.dead_seed_max_ratio, {
    min: 0,
  });
  setNumericError(errors, "min-current-users", cleanup.min_current_users, {
    min: 0,
    integer: true,
  });
  setNumericError(errors, "min-upload-speed", cleanup.min_upload_speed_kbps, {
    min: 0,
    integer: true,
  });
  setNumericError(errors, "elimination-ratio", cleanup.elimination_ratio, {
    min: 0,
    max: 50,
    integer: true,
  });

  return errors;
}

export function getFirstConfigErrorField(errors: ConfigValidationErrors) {
  return CONFIG_FIELD_ORDER.find((fieldId) => errors[fieldId]) ?? null;
}

export function getConfigSectionsForErrors(errors: ConfigValidationErrors) {
  return Array.from(
    new Set(
      CONFIG_FIELD_ORDER.filter((fieldId) => errors[fieldId]).map(
        (fieldId) => CONFIG_FIELD_SECTION[fieldId],
      ),
    ),
  );
}
