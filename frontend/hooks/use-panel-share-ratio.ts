/**
 * PANEL - 分享率历史数据 Hook
 * 根据时间范围获取分享率历史数据
 */

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { TimeRange } from "@/lib/types";

interface BackendDataPoint {
  timestamp: number;
  mteam: {
    uploaded: number;
    downloaded: number;
    share_ratio: number;
  };
  qbittorrent: {
    uploaded: number;
    downloaded: number;
    share_ratio: number;
  };
}

interface BackendShareRatioResponse {
  range: string;
  aggregation: string;
  data_points: BackendDataPoint[];
}

interface ChartDataPoint {
  time: string;
  分享率: number;
}

async function shareRatioFetcher(url: string): Promise<ChartDataPoint[]> {
  try {
    const data = await fetcher<BackendShareRatioResponse>(url);

    // 转换后端数据为图表格式
    const chartData: ChartDataPoint[] = data.data_points.map((point) => {
      const date = new Date(point.timestamp * 1000);

      return {
        time: date.toLocaleTimeString("zh-CN", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        分享率: (point as any).share_ratio || point.mteam?.share_ratio || 0,
      };
    });

    return chartData;
  } catch (error) {
    // If API doesn't exist, return empty array to trigger mock data
    console.warn("Share ratio API not available, using mock data:", error);
    return [];
  }
}

export function usePanelShareRatio(range: TimeRange) {
  return useSWR<ChartDataPoint[]>(
    `/api/panel/share-ratio?range=${range}`,
    shareRatioFetcher,
    {
      refreshInterval: 300000, // 5分钟刷新
      revalidateOnFocus: false,
      onError: (error) => {
        console.warn("Failed to fetch share ratio data:", error);
      },
      shouldRetryOnError: false, // Don't retry if endpoint doesn't exist
    }
  );
}
