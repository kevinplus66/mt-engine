/**
 * PANEL - 种子列表 Hook
 * 获取面板的种子监控数据
 */

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { Torrent } from "@/lib/types";

interface BackendTorrentsResponse {
  torrents: Torrent[];
  total_count: number;
  filtered_count: number;
}

async function torrentsFetcher(url: string): Promise<Torrent[]> {
  const data = await fetcher<BackendTorrentsResponse>(url);
  return data.torrents || [];
}

export function usePanelTorrents() {
  return useSWR<Torrent[]>("/api/panel/torrents", torrentsFetcher, {
    refreshInterval: 60000, // 60秒刷新
    revalidateOnFocus: false,
  });
}
