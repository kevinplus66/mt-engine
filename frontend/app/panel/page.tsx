"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { AlertCircle, BarChart3 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PageScaffold } from "@/components/common/page-scaffold";
import { SectionCard } from "@/components/common/section-card";
import { StateCard } from "@/components/common/state-card";
import { PanelRangeControl } from "@/components/panel/panel-range-control";
import { StatsGrid } from "@/components/panel/stats-grid";
import { TorrentMonitor } from "@/components/panel/torrent-monitor";
import { usePanelTimeRangeQuery } from "@/hooks/use-panel-time-range-query";
import { usePanelStats } from "@/hooks/use-panel-stats";

import type { TimeRange } from "@/lib/types";

const panelRatioFormatter = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const panelCountFormatter = new Intl.NumberFormat("zh-CN");

type PanelChartProps = {
  timeRange: TimeRange;
};

function PanelChartFallback() {
  return (
    <StateCard
      icon={BarChart3}
      iconClassName="motion-safe:animate-pulse"
      title="加载趋势图…"
      description="正在载入图表组件…"
    />
  );
}

const TrafficChart = dynamic<PanelChartProps>(
  () =>
    import("@/components/panel/traffic-chart").then(
      (module) => module.TrafficChart,
    ),
  { loading: PanelChartFallback },
);

const ShareRatioChart = dynamic<PanelChartProps>(
  () =>
    import("@/components/panel/share-ratio-chart").then(
      (module) => module.ShareRatioChart,
    ),
  { loading: PanelChartFallback },
);

function PanelPageContent() {
  const { data: stats, isLoading, error } = usePanelStats();
  const { timeRange, setPanelTimeRange } = usePanelTimeRangeQuery();

  return (
    <PageScaffold
      eyebrow="PANEL"
      title="数据面板"
      description="qBittorrent 当前状态、流量趋势和种子监控。"
      icon={BarChart3}
      meta={
        stats && (
          <>
            <Badge variant="success">
              做种 {panelCountFormatter.format(stats.seeding_count)}
            </Badge>
            <Badge variant="info">
              下载 {panelCountFormatter.format(stats.downloading_count)}
            </Badge>
            <Badge variant="outline">
              分享率 {panelRatioFormatter.format(stats.share_ratio)}
            </Badge>
          </>
        )
      }
    >

      {error && (
        <Alert variant="error">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertTitle>统计数据加载失败</AlertTitle>
          <AlertDescription>
            <span>{error.message}</span>{" "}
            <span>请稍后重试，或检查 qBittorrent 连接状态。</span>
          </AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <StateCard
          icon={BarChart3}
          iconClassName="motion-safe:animate-pulse"
          title="加载统计数据…"
          description="正在读取 PANEL 指标…"
        />
      )}

      {!isLoading && stats && <StatsGrid stats={stats} />}

      <section aria-labelledby="panel-trends-heading" className="space-y-6">
        <SectionCard
          title={<span id="panel-trends-heading">趋势窗口</span>}
          description="选择下方流量与分享率图表的统计时间范围。"
          action={
            <PanelRangeControl
              ariaLabel="趋势窗口图表时间范围"
              value={timeRange}
              onValueChange={setPanelTimeRange}
            />
          }
        />

        <div className="grid gap-4 xl:grid-cols-2">
          <TrafficChart timeRange={timeRange} />
          <ShareRatioChart timeRange={timeRange} />
        </div>
      </section>

      <TorrentMonitor />
    </PageScaffold>
  );
}

export default function PanelPage() {
  return (
    <Suspense
      fallback={
        <StateCard
          icon={BarChart3}
          iconClassName="motion-safe:animate-pulse"
          title="加载中…"
        />
      }
    >
      <PanelPageContent />
    </Suspense>
  );
}
