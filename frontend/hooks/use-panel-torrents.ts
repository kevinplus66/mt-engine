/**
 * PANEL - 种子列表 Hook
 * 获取面板的种子监控数据
 */

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { BackendPanelTorrentsResponse } from "@/lib/api-models";
import type { PanelTorrent } from "@/lib/panel-torrents";

export async function torrentsFetcher(url: string): Promise<PanelTorrent[]> {
  const data = await fetcher<BackendPanelTorrentsResponse>(url);
  if (data.error) {
    throw new Error(data.error);
  }

  return data.torrents || [];
}

export function usePanelTorrents() {
  return useSWR<PanelTorrent[]>("/api/panel/torrents", torrentsFetcher, {
    refreshInterval: 60000, // 60秒刷新
    revalidateOnFocus: false,
  });
}
