/**
 * RADAR - 筛选选项 Hook
 * 获取动态筛选选项（分类、清晰度、编码等）
 */

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { FilterOptions } from "@/lib/types";

export function useFilterOptions() {
  return useSWR<FilterOptions>("/api/filter-options", fetcher, {
    // 筛选选项不经常变化，可以缓存较长时间
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 3600000, // 1小时内不重复请求
  });
}
