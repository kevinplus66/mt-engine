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
  timestamp: number;
  time: string;
  上传: number;
  下载: number;
}

interface NormalizedDataPoint {
  timestamp: number;
  uploaded: number;
  downloaded: number;
}

type HistoryRange = "6h" | "24h" | "7d" | "30d";
type TrafficSource = "qbittorrent" | "mteam";

function getRangeFromUrl(url: string): HistoryRange {
  const rangeMatch = url.match(/range=([^&]+)/);
  const range = rangeMatch ? rangeMatch[1] : "24h";

  if (range === "6h" || range === "7d" || range === "30d") {
    return range;
  }
  return "24h";
}

function getExpectedIntervalSeconds(range: HistoryRange): number {
  switch (range) {
    case "7d":
      return 3600; // 1 hour
    case "30d":
      return 86400; // 1 day
    case "6h":
    case "24h":
    default:
      return 60; // 1 minute
  }
}

function getRateWindowSeconds(range: HistoryRange): number {
  switch (range) {
    case "6h":
      return 600; // 10 minutes
    case "24h":
      return 1200; // 20 minutes
    case "7d":
      return 14400; // 4 hours
    case "30d":
      return 172800; // 2 days
    default:
      return 1200;
  }
}

function pickPrimarySource(): TrafficSource {
  // PANEL 流量趋势固定使用 M-Team 口径，保持与站点统计一致。
  return "mteam";
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

function normalizeCumulativeData(
  dataPoints: BackendDataPoint[],
  source: TrafficSource
): NormalizedDataPoint[] {
  const normalized: NormalizedDataPoint[] = [];

  let lastUploaded: number | undefined;
  let lastDownloaded: number | undefined;

  for (let i = 0; i < dataPoints.length; i++) {
    const point = dataPoints[i];
    const timestamp = point.timestamp * 1000;
    const sourcePoint = point[source];

    const rawUploaded = Math.max(0, sourcePoint?.uploaded ?? 0);
    const rawDownloaded = Math.max(0, sourcePoint?.downloaded ?? 0);

    let uploaded = rawUploaded;
    let downloaded = rawDownloaded;

    // 处理异常值：
    // 1) API 偶发返回 0（沿用上一点）
    // 2) 计数器倒退（视为脏数据，沿用上一点）
    if (lastUploaded !== undefined) {
      if (rawUploaded === 0 || rawUploaded < lastUploaded) {
        uploaded = lastUploaded;
      }
    }

    if (lastDownloaded !== undefined) {
      if (rawDownloaded === 0 || rawDownloaded < lastDownloaded) {
        downloaded = lastDownloaded;
      }
    }

    normalized.push({
      timestamp,
      uploaded,
      downloaded,
    });

    lastUploaded = uploaded;
    lastDownloaded = downloaded;
  }

  return normalized;
}

function buildRateSeries(
  normalizedData: NormalizedDataPoint[],
  expectedIntervalSeconds: number,
  range: HistoryRange
): ChartDataPoint[] {
  const windowMs = getRateWindowSeconds(range) * 1000;
  const result: ChartDataPoint[] = [];

  for (let i = 0; i < normalizedData.length; i++) {
    const current = normalizedData[i];
    const currentDate = new Date(current.timestamp);

    let uploadDelta = 0;
    let downloadDelta = 0;

    if (i > 0) {
      let startIndex = i - 1;
      while (
        startIndex > 0 &&
        current.timestamp - normalizedData[startIndex].timestamp < windowMs
      ) {
        startIndex -= 1;
      }

      const start = normalizedData[startIndex];
      const elapsedSeconds = Math.max(
        1,
        Math.round((current.timestamp - start.timestamp) / 1000)
      );

      const uploadTotal = Math.max(0, current.uploaded - start.uploaded);
      const downloadTotal = Math.max(0, current.downloaded - start.downloaded);

      // 统一换算为“每 expectedInterval 的增量”，保证不同时间窗口可比较
      const normalizeRatio = expectedIntervalSeconds / elapsedSeconds;
      uploadDelta = Math.round(uploadTotal * normalizeRatio);
      downloadDelta = Math.round(downloadTotal * normalizeRatio);
    }

    result.push({
      timestamp: current.timestamp,
      time: currentDate.toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      上传: uploadDelta,
      下载: downloadDelta,
    });
  }

  return result;
}

async function historyFetcher(url: string): Promise<ChartDataPoint[]> {
  const data = await fetcher<BackendHistoryResponse>(url);
  const range = getRangeFromUrl(url);
  const expectedIntervalSeconds = getExpectedIntervalSeconds(range);
  const primarySource = pickPrimarySource();
  const normalizedData = normalizeCumulativeData(data.data_points, primarySource);
  const chartData = buildRateSeries(normalizedData, expectedIntervalSeconds, range);

  // 根据时间范围选择平滑窗口大小
  let windowSize = 3;
  if (range === "6h") {
    windowSize = 3;
  } else if (range === "24h") {
    windowSize = 5;
  } else if (range === "7d") {
    windowSize = 5;
  } else if (range === "30d") {
    windowSize = 3;
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
