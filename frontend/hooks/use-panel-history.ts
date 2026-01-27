/**
 * PANEL - 历史数据 Hook
 * 根据时间范围获取历史流量数据
 */

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { TimeRange } from "@/lib/types";

interface BackendDataPoint {
  timestamp: number;
  mteam: {
    uploaded: number;
    downloaded: number;
  };
  qbittorrent: {
    uploaded: number;
    downloaded: number;
  };
}

interface BackendHistoryResponse {
  range: string;
  aggregation: string;
  data_points: BackendDataPoint[];
}

interface ChartDataPoint {
  time: string;
  上传: number;
  下载: number;
}

async function historyFetcher(url: string): Promise<ChartDataPoint[]> {
  const data = await fetcher<BackendHistoryResponse>(url);

  // 转换后端数据为图表格式，计算增量变化
  const chartData: ChartDataPoint[] = [];

  for (let i = 0; i < data.data_points.length; i++) {
    const point = data.data_points[i];
    const date = new Date(point.timestamp * 1000);

    // 计算与上一个时间点的差值（增量）
    let uploadDelta = 0;
    let downloadDelta = 0;

    if (i > 0) {
      const prevPoint = data.data_points[i - 1];
      uploadDelta = Math.max(0, point.mteam.uploaded - prevPoint.mteam.uploaded);
      downloadDelta = Math.max(0, point.mteam.downloaded - prevPoint.mteam.downloaded);
    }

    chartData.push({
      time: date.toLocaleTimeString("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      上传: uploadDelta,
      下载: downloadDelta,
    });
  }

  return chartData;
}

export function usePanelHistory(range: TimeRange) {
  return useSWR<ChartDataPoint[]>(`/api/panel/history?range=${range}`, historyFetcher, {
    refreshInterval: 300000, // 5分钟刷新
    revalidateOnFocus: false,
  });
}
