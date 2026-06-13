/**
 * StatsGrid - PANEL statistics.
 */

"use client";

import {
  Activity,
  ArrowDown,
  ArrowUp,
  Download,
  TrendingUp,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatBytes } from "@/lib/formatters";
import type { PanelStats } from "@/lib/types";

const ratioFormatter = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const countFormatter = new Intl.NumberFormat("zh-CN");

interface StatsGridProps {
  stats: PanelStats;
}

function formatCount(value: number) {
  return countFormatter.format(value);
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  helper: ReactNode;
  icon: LucideIcon;
}) {
  return (
    <div>
      <Card className="h-full">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-muted-foreground text-sm">{label}</p>
              <p className="mt-2 truncate font-heading text-2xl font-semibold tabular-nums">
                {value}
              </p>
              <div className="mt-2 text-muted-foreground text-xs">{helper}</div>
            </div>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/36">
              <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function StatsGrid({ stats }: StatsGridProps) {
  const formatSpeed = (bytesPerSecond: number) => `${formatBytes(bytesPerSecond)}/s`;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="总上传"
        value={formatBytes(stats.total_upload)}
        icon={Upload}
        helper={
          <span className="inline-flex items-center gap-1">
            <ArrowUp className="size-3" aria-hidden="true" /> {formatSpeed(stats.upload_speed)}
          </span>
        }
      />
      <StatCard
        label="总下载"
        value={formatBytes(stats.total_download)}
        icon={Download}
        helper={
          <span className="inline-flex items-center gap-1">
            <ArrowDown className="size-3" aria-hidden="true" /> {formatSpeed(stats.download_speed)}
          </span>
        }
      />
      <StatCard
        label="分享率"
        value={ratioFormatter.format(stats.share_ratio)}
        icon={TrendingUp}
        helper="上传 / 下载"
      />
      <StatCard
        label="活跃种子"
        value={formatCount(stats.active_torrents)}
        icon={Activity}
        helper={`做种 ${formatCount(stats.seeding_count)} · 下载 ${formatCount(stats.downloading_count)}`}
      />
    </div>
  );
}
