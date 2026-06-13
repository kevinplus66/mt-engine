import { z } from "zod";
import type { AutomationConfig } from "./types";

const ruleConfigSchema = z.object({
  min_size_gb: z.number().min(0),
  max_size_gb: z.number().min(0),
  discount_types: z.array(z.string()),
  include_keywords: z.array(z.string()),
  exclude_keywords: z.array(z.string()),
  max_seeders: z.number().int().min(0),
  min_leechers: z.number().int().min(0),
  weight_size: z.number().min(-10).max(10),
  weight_free_time: z.number().min(-10).max(10),
  weight_age: z.number().min(-10).max(10),
  weight_seeders: z.number().min(-10).max(10),
});

const downloadPolicySchema = z.object({
  enabled: z.boolean(),
  max_active_tasks: z.number().int().min(1).max(50),
  interval_seconds: z.number().int().min(60),
  save_path: z
    .string()
    .refine((value) => value.trim().length > 0, "save_path is required"),
  disk_usage_threshold: z.number().int().min(50).max(95),
  rules: ruleConfigSchema,
});

const cleanupPolicySchema = z.object({
  enabled: z.boolean(),
  min_share_ratio: z.number().min(0),
  min_seed_time_hours: z.number().int().min(0),
  max_download_time_hours: z.number().int().min(0),
  dead_seed_minutes: z.number().int().min(5),
  dead_seed_max_ratio: z.number().min(0),
  min_current_users: z.number().int().min(0),
  min_upload_speed_kbps: z.number().int().min(0),
  elimination_ratio: z.number().int().min(0).max(50),
});

export const pilotConfigSchema = z.object({
  download: downloadPolicySchema,
  cleanup: cleanupPolicySchema,
  enable_notification: z.boolean(),
});

export type PilotConfig = z.infer<typeof pilotConfigSchema>;

export function parsePilotConfig(config: unknown): AutomationConfig {
  return pilotConfigSchema.parse(config);
}
