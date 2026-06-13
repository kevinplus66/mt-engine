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
import { formatCompactDateTime } from "@/lib/formatters";
import type { PilotStats } from "@/lib/types";

interface StatsBarProps {
  stats: PilotStats;
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
  const diskUsage =
    stats.disk_usage_percent !== undefined && stats.disk_usage_percent !== null
      ? `${stats.disk_usage_percent.toFixed(1)}%`
      : "N/A";

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

      <StatCard label="磁盘使用率" value={diskUsage} icon={HardDrive} />

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
