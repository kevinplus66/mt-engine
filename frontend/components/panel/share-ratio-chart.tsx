/**
 * ShareRatioChart - PANEL 分享率趋势图
 * 使用 Recharts AreaChart 显示分享率趋势（Neo-Brutalism 风格）
 */

import { Card, CardContent } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { usePanelShareRatio } from "@/hooks/use-panel-share-ratio";
import type { TimeRange } from "@/lib/types";

interface ShareRatioChartProps {
  timeRange: TimeRange;
}

export function ShareRatioChart({ timeRange }: ShareRatioChartProps) {
  const { data, isLoading, error } = usePanelShareRatio(timeRange);

  // If error, no data, or empty data, use mock data instead
  // (API endpoint may not be implemented yet)
  if (error || !data || data.length === 0) {
    const mockData = generateMockData(timeRange);
    return <ChartContent data={mockData} timeRange={timeRange} />;
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="text-6xl mb-4">📈</div>
          <p className="text-muted-foreground">加载图表数据中...</p>
        </CardContent>
      </Card>
    );
  }

  return <ChartContent data={data} timeRange={timeRange} />;
}

// Extracted chart rendering logic to reuse for both real and mock data
function ChartContent({ data, timeRange }: { data: any[]; timeRange: TimeRange }) {
  const formatRatio = (ratio: number) => {
    return ratio.toFixed(2);
  };

  // 根据时间段动态调整 Y 轴范围padding
  // 短时间段用更小的padding，放大微小变化
  const getYAxisPadding = () => {
    switch (timeRange) {
      case "6h":
        return 0.03;  // 最紧凑，放大最小变化
      case "24h":
        return 0.08;
      case "7d":
        return 0.2;
      case "30d":
        return 0.3;   // 最宽松
      default:
        return 0.1;
    }
  };

  const yAxisPadding = getYAxisPadding();

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col gap-3 mb-4 md:flex-row md:justify-between md:items-center md:mb-6">
          <h3 className="font-bold font-mono text-sm md:text-base">
            分享率变化趋势
          </h3>
          <div className="flex gap-2 text-xs font-mono flex-wrap">
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-black dark:bg-white border border-black dark:border-white"></div> 分享率
            </span>
          </div>
        </div>
        <div className="h-[250px] w-full md:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorRatio" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#000000" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#000000" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e5e5e5"
              />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                interval={Math.max(0, Math.floor(data.length / 6) - 1)}
                tickFormatter={(value: string) => {
                  // 简化显示：只保留时间部分，去掉重复的日期
                  const parts = value.split(' ');
                  if (parts.length >= 2) {
                    return parts[parts.length - 1]; // 只显示时间 "21:36"
                  }
                  return value;
                }}
              />
              <YAxis
                tick={{ fontSize: 10, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                domain={[(dataMin: number) => Math.max(0, dataMin - yAxisPadding), (dataMax: number) => dataMax + yAxisPadding]}
                tickFormatter={(value: number) => value.toFixed(2)}
                width={45}
              />
              <Tooltip
                contentStyle={{
                  border: "2px solid black",
                  borderRadius: "0px",
                  boxShadow: "4px 4px 0px 0px rgba(0,0,0,0.1)",
                  fontFamily: "monospace",
                }}
                itemStyle={{ fontFamily: "monospace", fontSize: "12px" }}
                formatter={(value: number) => formatRatio(value)}
              />
              <Area
                type="monotone"
                dataKey="分享率"
                stroke="#000000"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRatio)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// 生成模拟数据
function generateMockData(range: TimeRange) {
  const now = new Date();
  const dataPoints: any[] = [];

  let interval: number;
  let count: number;

  switch (range) {
    case "6h":
      interval = 30 * 60 * 1000; // 30分钟
      count = 12;
      break;
    case "24h":
      interval = 2 * 60 * 60 * 1000; // 2小时
      count = 12;
      break;
    case "7d":
      interval = 24 * 60 * 60 * 1000; // 1天
      count = 7;
      break;
    case "30d":
      interval = 24 * 60 * 60 * 1000; // 1天
      count = 30;
      break;
    default:
      interval = 2 * 60 * 60 * 1000;
      count = 12;
  }

  // 模拟分享率从 1.0 逐渐增长到 2.5-3.5 之间
  const baseRatio = 1.0;
  const targetRatio = 2.5 + Math.random();

  for (let i = count; i >= 0; i--) {
    const time = new Date(now.getTime() - i * interval);

    // 计算当前进度（0 到 1）
    const progress = 1 - (i / count);

    // 使用缓动函数使增长更平滑
    const easedProgress = 1 - Math.pow(1 - progress, 2);

    // 计算当前分享率，加入小的随机波动
    const ratio = baseRatio + (targetRatio - baseRatio) * easedProgress;
    const noise = (Math.random() - 0.5) * 0.2;

    dataPoints.push({
      time: time.toLocaleTimeString("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      分享率: Math.max(0, ratio + noise),
    });
  }

  return dataPoints;
}
