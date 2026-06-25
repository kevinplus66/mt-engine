/**
 * SONAR - 免费种子 Hook
 * 自动每 5 分钟刷新一次
 */

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { Torrent } from "@/lib/types";

export async function torrentsFetcher(url: string): Promise<Torrent[]> {
  const data = await fetcher<{
    torrents: Torrent[];
    error?: string | null;
    free_refresh_backoff_reason?: string | null;
    free_refresh_backoff_until?: string | null;
  }>(url);
  const cacheError =
    data.error ||
    data.free_refresh_backoff_reason ||
    (data.free_refresh_backoff_until ? "Refresh backoff active" : null);
  if (cacheError) {
    throw new Error(cacheError);
  }

  return data.torrents;
}

export function useSonarTorrents() {
  return useSWR<Torrent[]>("/api/torrents", torrentsFetcher, {
    refreshInterval: 300000, // 5 分钟
    revalidateOnFocus: false,
  });
}
