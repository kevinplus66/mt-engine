/**
 * PANEL - 统计数据 Hook
 * 每 5 分钟自动刷新
 */

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { BackendPanelStatsResponse } from "@/lib/api-models";
import type { PanelStats } from "@/lib/types";

async function panelStatsFetcher(url: string): Promise<PanelStats> {
  const data = await fetcher<BackendPanelStatsResponse>(url);
  const mteam = data.mteam;
  const qbittorrent = data.qbittorrent;
  const user = data.user;

  return {
    total_upload: mteam?.uploaded ?? 0,
    total_download: mteam?.downloaded ?? 0,
    share_ratio: user?.share_ratio ?? 0,
    active_torrents: (user?.seeding_count ?? 0) + (user?.leeching_count ?? 0),
    seeding_count: user?.seeding_count ?? 0,
    downloading_count: user?.leeching_count ?? 0,
    upload_speed: qbittorrent?.upload_speed ?? 0,
    download_speed: qbittorrent?.download_speed ?? 0,
  };
}

export function usePanelStats() {
  return useSWR<PanelStats>("/api/panel/stats", panelStatsFetcher, {
    refreshInterval: 300000, // 5 分钟
    revalidateOnFocus: false,
  });
}
