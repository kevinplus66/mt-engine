/**
 * PANEL - 统计数据 Hook
 * 每 5 分钟自动刷新
 */

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { PanelStats } from "@/lib/types";

interface BackendPanelStats {
  mteam: {
    uploaded: number;
    downloaded: number;
  };
  qbittorrent: {
    uploaded: number;
    downloaded: number;
    upload_speed: number;
    download_speed: number;
  };
  user: {
    share_ratio: number;
    seeding_count: number;
    leeching_count: number;
  };
}

async function panelStatsFetcher(url: string): Promise<PanelStats> {
  const data = await fetcher<BackendPanelStats>(url);
  return {
    total_upload: data.user.seeding_count > 0 ? data.mteam.uploaded : 0,
    total_download: data.mteam.downloaded,
    share_ratio: data.user.share_ratio,
    active_torrents: data.user.seeding_count + data.user.leeching_count,
    seeding_count: data.user.seeding_count,
    downloading_count: data.user.leeching_count,
    upload_speed: data.qbittorrent.upload_speed,
    download_speed: data.qbittorrent.download_speed,
  };
}

export function usePanelStats() {
  return useSWR<PanelStats>("/api/panel/stats", panelStatsFetcher, {
    refreshInterval: 300000, // 5 分钟
    revalidateOnFocus: false,
  });
}
