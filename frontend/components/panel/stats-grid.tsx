/**
 * StatsGrid - PANEL 统计卡片网格
 * 显示上传、下载、分享率、活跃种子等统计信息
 */

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ArrowUp, ArrowDown, TrendingUp, Activity, Upload, Download } from "lucide-react";
import { motion } from "framer-motion";
import type { PanelStats } from "@/lib/types";

interface StatsGridProps {
  stats: PanelStats;
}

export function StatsGrid({ stats }: StatsGridProps) {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSecond: number) => {
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* 总上传 */}
      <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.1 }}>
        <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                总上传
              </p>
              <p className="text-2xl font-bold">
                {formatBytes(stats.total_upload)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                <ArrowUp className="inline h-3 w-3" /> {formatSpeed(stats.upload_speed)}
              </p>
            </div>
            <Upload className="h-8 w-8 text-green-500" />
          </div>
        </CardContent>
      </Card>
      </motion.div>

      {/* 总下载 */}
      <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.1 }}>
        <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                总下载
              </p>
              <p className="text-2xl font-bold">
                {formatBytes(stats.total_download)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                <ArrowDown className="inline h-3 w-3" /> {formatSpeed(stats.download_speed)}
              </p>
            </div>
            <Download className="h-8 w-8 text-blue-500" />
          </div>
        </CardContent>
      </Card>
      </motion.div>

      {/* 分享率 */}
      <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.1 }}>
        <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                分享率
              </p>
              <p className="text-2xl font-bold">
                {stats.share_ratio.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                上传/下载比例
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-500" />
          </div>
        </CardContent>
      </Card>
      </motion.div>

      {/* 活跃种子 */}
      <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.1 }}>
        <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                活跃种子
              </p>
              <p className="text-2xl font-bold">{stats.active_torrents}</p>
              <p className="text-xs text-muted-foreground mt-1">
                做种 {stats.seeding_count} · 下载 {stats.downloading_count}
              </p>
            </div>
            <Activity className="h-8 w-8 text-orange-500" />
          </div>
        </CardContent>
      </Card>
      </motion.div>
    </div>
  );
}
