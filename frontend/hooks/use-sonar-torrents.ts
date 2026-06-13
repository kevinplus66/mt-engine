/**
 * SONAR - 免费种子 Hook
 * 自动每 5 分钟刷新一次
 */

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { Torrent } from "@/lib/types";

async function torrentsFetcher(url: string): Promise<Torrent[]> {
  const data = await fetcher<{ torrents: Torrent[] }>(url);
  return data.torrents;
}

export function useSonarTorrents() {
  return useSWR<Torrent[]>("/api/torrents", torrentsFetcher, {
    refreshInterval: 300000, // 5 分钟
    revalidateOnFocus: false,
  });
}
