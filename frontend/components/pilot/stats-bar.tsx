/**
 * StatsBar - PILOT 统计信息栏
 * 显示总下载、总清理、运行状态等信息
 */

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Trash2, Clock, Activity, HardDrive } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { formatBytes, formatCompactDateTime } from "@/lib/formatters";
import type { PilotStats } from "@/lib/types";

interface StatsBarProps {
  stats: PilotStats;
}

function formatPercent(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value.toFixed(1)}%`
    : "N/A";
}

function isFiniteNumber(value?: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatBudget(bytes: number) {
  return bytes < 0
    ? `超出 ${formatBytes(Math.abs(bytes))}`
    : `剩余预算 ${formatBytes(bytes)}`;
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  valueClassName = "truncate font-heading text-2xl font-semibold tabular-nums",
}: {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  icon: LucideIcon;
  valueClassName?: string;
}) {
  return (
    <Card className="h-full">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{label}</p>
            <div className={`mt-2 ${valueClassName}`}>{value}</div>
            {helper ? <div className="mt-2 text-xs text-muted-foreground">{helper}</div> : null}
          </div>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/36">
            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function StatsBar({ stats }: StatsBarProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return "从未运行";
    return formatCompactDateTime(dateString) || "从未运行";
  };

  const totalDownloads = stats.total_downloads ?? 0;
  const totalCleanups = stats.total_cleanups ?? 0;
  const projectedDiskUsagePercent =
    stats.projected_disk_usage_percent === undefined
      ? stats.disk_usage_percent
      : stats.projected_disk_usage_percent;
  const currentDiskUsagePercent =
    stats.current_disk_usage_percent === undefined
      ? stats.disk_usage_percent
      : stats.current_disk_usage_percent;
  const hasDiskUsageHelper =
    isFiniteNumber(currentDiskUsagePercent) ||
    isFiniteNumber(stats.active_download_remaining_bytes) ||
    isFiniteNumber(stats.disk_usage_threshold_percent) ||
    isFiniteNumber(stats.download_budget_bytes);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="本次运行"
        value={`${totalDownloads} / ${totalCleanups}`}
        icon={Download}
        helper={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <Download className="size-3" aria-hidden="true" />
              下载
            </span>
            <span className="inline-flex items-center gap-1">
              <Trash2 className="size-3" aria-hidden="true" />
              清理
            </span>
            <span>自容器启动</span>
          </span>
        }
      />

      <StatCard
        label="运行状态"
        value={
          <Badge variant={stats.is_running ? "success" : "secondary"} className="h-6 px-2">
            {stats.is_running ? (
              <>
                <Activity className="mr-1 size-3 animate-pulse" aria-hidden="true" />
                运行中
              </>
            ) : (
              <>
                <Clock className="mr-1 size-3" aria-hidden="true" />
                空闲
              </>
            )}
          </Badge>
        }
        icon={Activity}
        valueClassName=""
      />

      <StatCard
        label="预计占用"
        value={formatPercent(projectedDiskUsagePercent)}
        icon={HardDrive}
        helper={
          hasDiskUsageHelper ? (
            <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
              {isFiniteNumber(currentDiskUsagePercent) ? (
                <span>实际 {formatPercent(currentDiskUsagePercent)}</span>
              ) : null}
              {isFiniteNumber(stats.active_download_remaining_bytes) ? (
                <span>未完成预留 {formatBytes(stats.active_download_remaining_bytes)}</span>
              ) : null}
              {isFiniteNumber(stats.disk_usage_threshold_percent) ? (
                <span>阈值 {formatPercent(stats.disk_usage_threshold_percent)}</span>
              ) : null}
              {isFiniteNumber(stats.download_budget_bytes) ? (
                <span>{formatBudget(stats.download_budget_bytes)}</span>
              ) : null}
            </span>
          ) : undefined
        }
      />

      <StatCard
        label="运行时间"
        value={formatDate(stats.last_run)}
        icon={Clock}
        helper={
          <span className="inline-flex items-center gap-1">
            下次
            <span className="tabular-nums">{formatDate(stats.next_run)}</span>
          </span>
        }
      />
    </div>
  );
}
