/**
 * TrafficChart - PANEL 流量趋势图
 * 使用 Recharts AreaChart 显示上传/下载流量趋势（Neo-Brutalism 风格）
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
import { usePanelHistory } from "@/hooks/use-panel-history";
import type { TimeRange } from "@/lib/types";

interface TrafficChartProps {
  timeRange: TimeRange;
}

function formatXAxisTick(timestamp: number, range: TimeRange) {
  const date = new Date(timestamp);

  switch (range) {
    case "6h":
      return date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    case "24h":
      return date.toLocaleString("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    case "7d":
      return date.toLocaleString("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        hour12: false,
      });
    case "30d":
      return date.toLocaleDateString("zh-CN", {
        month: "numeric",
        day: "numeric",
      });
    default:
      return date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
  }
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

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-red-600">
          加载图表失败：{error.message}
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="text-6xl mb-4">📊</div>
          <p className="text-muted-foreground">加载图表数据中...</p>
        </CardContent>
      </Card>
    );
  }

  // 模拟数据（如果后端没有返回数据）
  const chartData = data || generateMockData(timeRange);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col gap-3 mb-4 md:flex-row md:justify-between md:items-center md:mb-6">
          <h3 className="font-bold font-mono text-sm md:text-base">
            流量变化趋势
          </h3>
          <div className="flex gap-2 text-xs font-mono flex-wrap">
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-black dark:bg-white border border-black dark:border-white"></div> 上传增量
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gray-400 border border-black dark:border-white"></div> 下载增量
            </span>
          </div>
        </div>
        <div className="h-[250px] w-full md:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorUpload" x1="0" y1="0" x2="0" y2="1">
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
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickCount={getTickCount(timeRange)}
                minTickGap={24}
                tick={{ fontSize: 10, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: number) => formatXAxisTick(value, timeRange)}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  color: "#000000",
                  border: "2px solid black",
                  borderRadius: "0px",
                  boxShadow: "4px 4px 0px 0px rgba(0,0,0,0.1)",
                  fontFamily: "monospace",
                }}
                itemStyle={{ fontFamily: "monospace", fontSize: "12px", color: "#000000" }}
                labelFormatter={(label: number) =>
                  new Date(label).toLocaleString("zh-CN", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })
                }
                formatter={(value: number) => formatBytes(value)}
              />
              <Area
                type="monotone"
                dataKey="上传"
                stroke="var(--foreground)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorUpload)"
              />
              <Area
                type="monotone"
                dataKey="下载"
                stroke="#9ca3af"
                strokeWidth={2}
                fillOpacity={0.2}
                fill="#9ca3af"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// 生成模拟数据（增量数据，而非累计）
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

  for (let i = count; i >= 0; i--) {
    const time = new Date(now.getTime() - i * interval);
    const hour = time.getHours();

    // 模拟流量波动（白天流量高，晚上流量低）
    // 这些是时间段内的增量，不是累计值
    const dayFactor = hour >= 9 && hour <= 22 ? 1.5 : 0.5;
    const randomFactor = 0.7 + Math.random() * 0.6;

    // 基础速率：上传 10MB/s, 下载 5MB/s
    // 根据时间间隔计算该时段的总流量
    const seconds = interval / 1000;
    const baseUploadRate = 10 * 1024 * 1024; // 10 MB/s
    const baseDownloadRate = 5 * 1024 * 1024; // 5 MB/s

    dataPoints.push({
      timestamp: time.getTime(),
      time: time.toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      上传: Math.floor(baseUploadRate * seconds * dayFactor * randomFactor),
      下载: Math.floor(baseDownloadRate * seconds * dayFactor * randomFactor),
    });
  }

  return dataPoints;
}
