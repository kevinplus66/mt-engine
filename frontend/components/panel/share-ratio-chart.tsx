/**
 * ShareRatioChart - PANEL 分享率趋势图
 * 使用 Recharts AreaChart 显示分享率趋势
 */

import { useId } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StateCard } from "@/components/common/state-card";
import { AlertCircle, TrendingUp } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useReducedMotion } from "framer-motion";
import { usePanelShareRatio } from "@/hooks/use-panel-share-ratio";
import {
  formatPanelTooltipDateTime,
  formatPanelXAxisTick,
} from "@/lib/formatters";
import type { TimeRange } from "@/lib/types";

interface ShareRatioChartProps {
  timeRange: TimeRange;
}

const ratioFormatter = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface ChartDataPoint {
  timestamp: number;
  time: string;
  分享率: number;
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

export function ShareRatioChart({ timeRange }: ShareRatioChartProps) {
  const { data, isLoading, error } = usePanelShareRatio(timeRange);

  if (isLoading) {
    return (
      <StateCard
        icon={TrendingUp}
        iconClassName="motion-safe:animate-pulse"
        title="加载图表数据…"
        description="正在读取分享率趋势…"
      />
    );
  }

  if (error) {
    return (
      <StateCard
        icon={AlertCircle}
        title="加载分享率趋势失败"
        description={`${error.message} 请稍后重试，或检查 PANEL 历史采集是否正常。`}
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <StateCard
        icon={TrendingUp}
        title="暂无分享率趋势数据"
        description="当前时间范围内没有可绘制的分享率历史点。"
      />
    );
  }

  return <ChartContent data={data} timeRange={timeRange} />;
}

function ChartContent({
  data,
  timeRange,
}: {
  data: ChartDataPoint[];
  timeRange: TimeRange;
}) {
  const titleId = useId();
  const summaryId = useId();
  const gradientId = `${titleId}-colorRatio`;
  const shouldReduceMotion = useReducedMotion();

  const formatRatio = (ratio: number) => ratioFormatter.format(ratio);

  const getMinPadding = () => {
    switch (timeRange) {
      case "6h":
        return 0.02;
      case "24h":
        return 0.04;
      case "7d":
        return 0.08;
      case "30d":
        return 0.12;
      default:
        return 0.05;
    }
  };

  const ratios = data.map((point) => point.分享率);
  const minRatio = Math.min(...ratios);
  const maxRatio = Math.max(...ratios);
  const rangeSize = Math.max(0, maxRatio - minRatio);
  const yAxisPadding = Math.max(getMinPadding(), rangeSize * 0.45);
  const yAxisDomain = [
    Math.max(0, minRatio - yAxisPadding),
    maxRatio + yAxisPadding,
  ];
  const latestPoint = data[data.length - 1];
  const summary = `分享率趋势图，共 ${data.length} 个数据点。最新分享率 ${formatRatio(latestPoint.分享率)}，时间 ${formatPanelTooltipDateTime(latestPoint.timestamp)}；区间最低 ${formatRatio(minRatio)}，最高 ${formatRatio(maxRatio)}。`;

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col gap-3 mb-4 md:flex-row md:justify-between md:items-center md:mb-6">
          <h3 id={titleId} className="font-heading font-semibold text-sm md:text-base">
            分享率变化趋势
          </h3>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-[var(--chart-3)]" aria-hidden="true" /> 分享率
            </span>
          </div>
        </div>
        <p id={summaryId} className="sr-only">
          {summary}
        </p>
        <div className="h-[250px] w-full md:h-[300px]">
          <div
            role="img"
            aria-labelledby={titleId}
            aria-describedby={summaryId}
            className="h-full w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0} />
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
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  domain={yAxisDomain}
                  tickFormatter={(value: number) => formatRatio(value)}
                  width={45}
                />
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
                  formatter={(value: number) => formatRatio(value)}
                />
                <Area
                  type="monotone"
                  dataKey="分享率"
                  stroke="var(--chart-3)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fillOpacity={1}
                  fill={`url(#${gradientId})`}
                  isAnimationActive={!shouldReduceMotion}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
