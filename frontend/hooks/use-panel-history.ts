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

/**
 * 移动平均平滑函数
 * 对数据应用移动平均算法，消除尖峰同时保留整体趋势
 * @param data 原始数据点数组
 * @param windowSize 平滑窗口大小（奇数，推荐3或5）
 * @returns 平滑后的数据点数组
 */
function smoothData(data: ChartDataPoint[], windowSize: number = 5): ChartDataPoint[] {
  if (data.length === 0 || windowSize <= 1) {
    return data;
  }

  const halfWindow = Math.floor(windowSize / 2);

  return data.map((point, i) => {
    // 计算窗口边界
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(data.length, i + halfWindow + 1);
    const window = data.slice(start, end);

    // 计算窗口内的平均值
    const avgUpload = window.reduce((sum, p) => sum + p.上传, 0) / window.length;
    const avgDownload = window.reduce((sum, p) => sum + p.下载, 0) / window.length;

    return {
      ...point,
      上传: Math.round(avgUpload),
      下载: Math.round(avgDownload),
    };
  });
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

  // 根据时间范围选择平滑窗口大小
  // 提取 URL 参数中的 range 值
  const rangeMatch = url.match(/range=([^&]+)/);
  const range = rangeMatch ? rangeMatch[1] : "24h";

  let windowSize = 5; // 默认 5 点平滑（适用于 5分钟间隔数据）

  // 对于长时间范围，使用较小的窗口以避免过度平滑
  if (range === "7d") {
    windowSize = 3; // 3 点平滑（1小时聚合数据）
  } else if (range === "30d") {
    windowSize = 3; // 3 点平滑（1天聚合数据）
  }

  // 应用移动平均平滑
  return smoothData(chartData, windowSize);
}

export function usePanelHistory(range: TimeRange) {
  return useSWR<ChartDataPoint[]>(`/api/panel/history?range=${range}`, historyFetcher, {
    refreshInterval: 300000, // 5分钟刷新
    revalidateOnFocus: false,
  });
}
