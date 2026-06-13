/**
 * PANEL - 历史数据 Hook
 * 根据时间范围获取历史流量数据
 */

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type {
  BackendPanelDataPoint,
  BackendPanelHistoryResponse,
} from "@/lib/api-models";
import { formatPanelPointTime } from "@/lib/formatters";
import type { TimeRange } from "@/lib/types";

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

  const result = new Array<ChartDataPoint>(data.length);
  const halfWindow = Math.floor(windowSize / 2);
  let start = 0;
  let end = 0;
  let uploadSum = 0;
  let downloadSum = 0;

  for (let i = 0; i < data.length; i++) {
    const nextStart = Math.max(0, i - halfWindow);
    const nextEnd = Math.min(data.length, i + halfWindow + 1);

    while (end < nextEnd) {
      uploadSum += data[end].上传;
      downloadSum += data[end].下载;
      end++;
    }

    while (start < nextStart) {
      uploadSum -= data[start].上传;
      downloadSum -= data[start].下载;
      start++;
    }

    const windowLength = end - start;
    result[i] = {
      ...data[i],
      上传: Math.round(uploadSum / windowLength),
      下载: Math.round(downloadSum / windowLength),
    };
  }

  return result;
}

function distributeMetricDelta(
  normalizedData: NormalizedDataPoint[],
  key: "uploaded" | "downloaded",
  expectedIntervalSeconds: number
) {
  const values = new Array(normalizedData.length).fill(0);
  if (normalizedData.length < 2) return values;

  let anchorIndex = 0;
  let anchorValue = normalizedData[0][key];

  for (let i = 1; i < normalizedData.length; i++) {
    const currentValue = normalizedData[i][key];
    if (currentValue <= anchorValue) continue;

    const elapsedSeconds = Math.max(
      1,
      Math.round(
        (normalizedData[i].timestamp - normalizedData[anchorIndex].timestamp) /
          1000
      )
    );
    const visualDelta = Math.round(
      ((currentValue - anchorValue) * expectedIntervalSeconds) / elapsedSeconds
    );
    const startIndex = anchorIndex === 0 ? anchorIndex : anchorIndex + 1;

    for (let j = startIndex; j <= i; j++) {
      values[j] = visualDelta;
    }

    anchorIndex = i;
    anchorValue = currentValue;
  }

  return values;
}

function softenTail(data: ChartDataPoint[], range: HistoryRange) {
  const windowSize = range === "30d" ? 3 : range === "7d" ? 5 : 7;
  return smoothData(data, windowSize);
}

function normalizeCumulativeData(
  dataPoints: BackendPanelDataPoint[],
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
  const uploadDeltas = distributeMetricDelta(
    normalizedData,
    "uploaded",
    expectedIntervalSeconds
  );
  const downloadDeltas = distributeMetricDelta(
    normalizedData,
    "downloaded",
    expectedIntervalSeconds
  );

  const result = normalizedData.map((point, index) => ({
    timestamp: point.timestamp,
    time: formatPanelPointTime(point.timestamp),
    上传: uploadDeltas[index],
    下载: downloadDeltas[index],
  }));

  return softenTail(result, range);
}

export async function historyFetcher(url: string): Promise<ChartDataPoint[]> {
  const data = await fetcher<BackendPanelHistoryResponse>(url);
  if (data.error) {
    throw new Error(data.error);
  }

  const range = getRangeFromUrl(url);
  const expectedIntervalSeconds = getExpectedIntervalSeconds(range);
  const primarySource = pickPrimarySource();
  const normalizedData = normalizeCumulativeData(
    data.data_points ?? [],
    primarySource
  );
  return buildRateSeries(normalizedData, expectedIntervalSeconds, range);
}

export function usePanelHistory(range: TimeRange) {
  return useSWR<ChartDataPoint[]>(`/api/panel/history?range=${range}`, historyFetcher, {
    refreshInterval: 300000, // 5分钟刷新
    revalidateOnFocus: false,
  });
}
