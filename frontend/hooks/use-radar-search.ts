/**
 * RADAR - 搜索种子 Hook
 * 使用 useSWRMutation 实现手动触发的搜索
 */

import useSWRMutation from "swr/mutation";
import { searchTorrents } from "@/lib/api";
import type { SearchRequest, SearchResponse } from "@/lib/types";

async function searchFetcher(
  _url: string,
  { arg }: { arg: SearchRequest }
): Promise<SearchResponse> {
  return searchTorrents(arg);
}

export function useRadarSearch() {
  return useSWRMutation("/api/radar", searchFetcher);
}
