/**
 * PILOT - 统计数据 Hook
 * 每 60 秒自动刷新
 */

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { PilotStats } from "@/lib/types";

/**
 * 后端 API 返回的统计数据格式
 */
interface BackendPilotStats {
  active_tasks: number;
  pending_downloads: number;
  download_enabled: boolean;
  cleanup_enabled: boolean;
  interval_seconds: number;
  total_downloads: number;
  total_cleanups: number;
  disk_usage_percent?: number | null;
  current_disk_usage_percent?: number | null;
  projected_disk_usage_percent?: number | null;
  active_download_remaining_bytes?: number | null;
  download_budget_bytes?: number | null;
  disk_usage_threshold_percent?: number | null;
  last_run: number | null;
  next_run: number | null;
  is_running: boolean;
}

/**
 * 将后端响应转换为前端期望的格式
 */
async function pilotStatsFetcher(url: string): Promise<PilotStats> {
  const data = await fetcher<BackendPilotStats>(url);

  const stats: PilotStats = {
    total_downloads: data.total_downloads || 0,
    total_cleanups: data.total_cleanups || 0,
    active_tasks: data.active_tasks || 0,
    pending_downloads: data.pending_downloads || 0,
    is_running: data.is_running,
    last_run: data.last_run ? new Date(data.last_run * 1000).toISOString() : undefined,
    next_run: data.next_run ? new Date(data.next_run * 1000).toISOString() : undefined,
  };

  if (data.disk_usage_percent !== undefined) {
    stats.disk_usage_percent = data.disk_usage_percent;
  }
  if (data.current_disk_usage_percent !== undefined) {
    stats.current_disk_usage_percent = data.current_disk_usage_percent;
  }
  if (data.projected_disk_usage_percent !== undefined) {
    stats.projected_disk_usage_percent = data.projected_disk_usage_percent;
  }
  if (data.active_download_remaining_bytes !== undefined) {
    stats.active_download_remaining_bytes = data.active_download_remaining_bytes;
  }
  if (data.download_budget_bytes !== undefined) {
    stats.download_budget_bytes = data.download_budget_bytes;
  }
  if (data.disk_usage_threshold_percent !== undefined) {
    stats.disk_usage_threshold_percent = data.disk_usage_threshold_percent;
  }

  return stats;
}

export function usePilotStats() {
  return useSWR<PilotStats>("/api/pilot/stats", pilotStatsFetcher, {
    refreshInterval: 60000, // 60 秒
    revalidateOnFocus: false,
  });
}
