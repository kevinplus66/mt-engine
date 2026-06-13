/**
 * TrafficChart - PANEL 流量趋势图
 * 使用 Recharts AreaChart 显示上传/下载流量趋势
 */

import { useId } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StateCard } from "@/components/common/state-card";
import { AlertCircle, BarChart3 } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { usePanelHistory } from "@/hooks/use-panel-history";
import {
  formatBytes,
  formatPanelTooltipDateTime,
  formatPanelXAxisTick,
} from "@/lib/formatters";
import { useReducedMotion } from "framer-motion";
import type { TimeRange } from "@/lib/types";

interface TrafficChartProps {
  timeRange: TimeRange;
}

function getTickCount(range: TimeRange) {
  switch (range) {
    case "6h":
      return 7;
    case "24h":
      return 8;
    case "7d":
      return 8;
    case "30d":
      return 10;
    default:
      return 8;
  }
}

export function TrafficChart({ timeRange }: TrafficChartProps) {
  const { data, isLoading, error } = usePanelHistory(timeRange);
  const titleId = useId();
  const uploadGradientId = `${titleId}-colorUpload`;
  const downloadGradientId = `${titleId}-colorDownload`;
  const shouldReduceMotion = useReducedMotion();
  const summaryId = useId();

  if (error) {
    return (
      <StateCard
        icon={AlertCircle}
        title="加载图表失败"
        description={error.message}
      />
    );
  }

  if (isLoading) {
    return (
      <StateCard
        icon={BarChart3}
        iconClassName="animate-pulse"
        title="加载图表数据"
        description="正在读取流量趋势"
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <StateCard
        icon={BarChart3}
        title="暂无流量趋势数据"
        description="当前时间范围内没有可绘制的历史流量点。"
      />
    );
  }

  const maxTraffic = Math.max(
    0,
    ...data.flatMap((point) => [point.上传, point.下载])
  );
  const yAxisMax = maxTraffic > 0 ? maxTraffic * 1.55 : 1;
  const latestPoint = data[data.length - 1];
  const summary = `流量变化趋势图，共 ${data.length} 个数据点。最新一点（${formatPanelTooltipDateTime(latestPoint.timestamp)}）：上传增量 ${formatBytes(latestPoint.上传)}，下载增量 ${formatBytes(latestPoint.下载)}；区间单点峰值 ${formatBytes(maxTraffic)}。`;

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col gap-3 mb-4 md:flex-row md:justify-between md:items-center md:mb-6">
          <h3 id={titleId} className="font-heading font-semibold text-sm md:text-base">
            流量变化趋势
          </h3>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-[var(--chart-1)]" aria-hidden="true" /> 上传增量
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-[var(--chart-2)]" aria-hidden="true" /> 下载增量
            </span>
          </div>
        </div>
        <p id={summaryId} className="sr-only">
          {summary}
        </p>
        <div
          role="img"
          aria-labelledby={titleId}
          aria-describedby={summaryId}
          className="h-[250px] w-full md:h-[300px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id={uploadGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id={downloadGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.14} />
                  <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
              />
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickCount={getTickCount(timeRange)}
                minTickGap={24}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: number) =>
                  formatPanelXAxisTick(value, timeRange)
                }
              />
              <YAxis hide domain={[0, yAxisMax]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  color: "var(--popover-foreground)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  boxShadow: "0 12px 30px rgba(0,0,0,0.08)",
                }}
                itemStyle={{ fontSize: "12px", color: "var(--foreground)" }}
                labelFormatter={(label: number) =>
                  formatPanelTooltipDateTime(label)
                }
                formatter={(value: number) => formatBytes(value)}
              />
              <Area
                type="monotone"
                dataKey="上传"
                stroke="var(--chart-1)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fillOpacity={1}
                fill={`url(#${uploadGradientId})`}
                isAnimationActive={!shouldReduceMotion}
              />
              <Area
                type="monotone"
                dataKey="下载"
                stroke="var(--chart-2)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fillOpacity={1}
                fill={`url(#${downloadGradientId})`}
                isAnimationActive={!shouldReduceMotion}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
