/**
 * PANEL - 分享率历史数据 Hook
 * 根据时间范围获取分享率历史数据
 */

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { BackendPanelShareRatioResponse } from "@/lib/api-models";
import { formatPanelPointTime } from "@/lib/formatters";
import type { TimeRange } from "@/lib/types";

interface ChartDataPoint {
  timestamp: number;
  time: string;
  分享率: number;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

export async function shareRatioFetcher(url: string): Promise<ChartDataPoint[]> {
  const data = await fetcher<BackendPanelShareRatioResponse>(url);
  if (data.error) {
    throw new Error(data.error);
  }

  const dataPoints = data.data_points ?? [];
  const positiveRatios: number[] = [];

  for (let i = 0; i < dataPoints.length; i++) {
    const ratio = dataPoints[i].share_ratio ?? 0;
    if (Number.isFinite(ratio) && ratio > 0) {
      positiveRatios.push(ratio);
    }
  }

  const baseline = median(positiveRatios);
  const minUsefulRatio = baseline > 0 ? baseline * 0.5 : 0;
  const filteredPoints: ChartDataPoint[] = [];

  for (let i = 0; i < dataPoints.length; i++) {
    const point = dataPoints[i];
    const ratio = point.share_ratio ?? 0;
    if (!Number.isFinite(ratio) || ratio <= 0 || ratio < minUsefulRatio) {
      continue;
    }

    const timestamp = point.timestamp * 1000;
    filteredPoints.push({
      timestamp,
      time: formatPanelPointTime(timestamp),
      分享率: ratio,
    });
  }

  if (filteredPoints.length > 0) {
    return filteredPoints;
  }

  for (let i = 0; i < dataPoints.length; i++) {
    const point = dataPoints[i];
    const ratio = point.share_ratio ?? 0;
    if (!Number.isFinite(ratio) || ratio <= 0) {
      continue;
    }

    const timestamp = point.timestamp * 1000;
    filteredPoints.push({
      timestamp,
      time: formatPanelPointTime(timestamp),
      分享率: ratio,
    });
  }

  return filteredPoints;
}

export function usePanelShareRatio(range: TimeRange) {
  return useSWR<ChartDataPoint[]>(
    `/api/panel/share-ratio?range=${range}`,
    shareRatioFetcher,
    {
      refreshInterval: 300000, // 5分钟刷新
      revalidateOnFocus: false,
    }
  );
}
