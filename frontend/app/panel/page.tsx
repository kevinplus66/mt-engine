"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { StatsGrid } from "@/components/panel/stats-grid";
import { TorrentMonitor } from "@/components/panel/torrent-monitor";
import { TrafficChart } from "@/components/panel/traffic-chart";
import { PageTransition } from "@/components/common/page-transition";
import { usePanelStats } from "@/hooks/use-panel-stats";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TimeRange = "1h" | "6h" | "24h" | "7d" | "30d";

export default function PanelPage() {
  const { data: stats, isLoading, error } = usePanelStats();
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");

  return (
    <PageTransition>
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="mx-auto max-w-[95%] space-y-6">
        {/* 标题 */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PANEL</h1>
          <p className="text-muted-foreground">数据面板</p>
        </div>

        {/* 错误提示 */}
        {error && (
          <Card className="p-6 text-center text-red-600">
            加载失败：{error.message}
          </Card>
        )}

        {/* 加载中 */}
        {isLoading && (
          <Card className="p-12 text-center">
            <div className="text-6xl mb-4">⏳</div>
            <p className="text-muted-foreground">加载统计数据中...</p>
          </Card>
        )}

        {/* 统计卡片网格 */}
        {!isLoading && stats && <StatsGrid stats={stats} />}

        {/* 时间范围选择器 */}
        <Card className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-semibold">流量趋势</h2>
            <div className="overflow-x-auto -mx-1 px-1">
              <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                <TabsList className="inline-flex">
                  <TabsTrigger value="1h" className="whitespace-nowrap">1小时</TabsTrigger>
                  <TabsTrigger value="6h" className="whitespace-nowrap">6小时</TabsTrigger>
                  <TabsTrigger value="24h" className="whitespace-nowrap">24小时</TabsTrigger>
                  <TabsTrigger value="7d" className="whitespace-nowrap">7天</TabsTrigger>
                  <TabsTrigger value="30d" className="whitespace-nowrap">30天</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </Card>

        {/* 流量趋势图 */}
        {!isLoading && <TrafficChart timeRange={timeRange} />}

        {/* 种子监控表 */}
        {!isLoading && <TorrentMonitor />}
        </div>
      </div>
    </PageTransition>
  );
}
