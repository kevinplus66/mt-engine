/**
 * StatsBar - PILOT 统计信息栏
 * 显示总下载、总清理、运行状态等信息
 */

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Trash2, Clock, Activity, HardDrive } from "lucide-react";
import { motion } from "framer-motion";
import type { PilotStats } from "@/lib/types";

interface StatsBarProps {
  stats: PilotStats;
}

export function StatsBar({ stats }: StatsBarProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return "从未运行";
    const date = new Date(dateString);
    return date.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* 本次运行统计 - 合并下载和清理 */}
      <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.1 }}>
        <Card className="h-full">
        <CardContent className="p-6 h-full flex flex-col justify-center">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground font-mono">
                本次运行
              </p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                自容器启动
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">下载</span>
              </div>
              <p className="text-xl font-bold font-mono">{stats.total_downloads ?? 0}</p>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-red-500" />
                <span className="text-sm text-muted-foreground">清理</span>
              </div>
              <p className="text-xl font-bold font-mono">{stats.total_cleanups ?? 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      </motion.div>

      {/* 运行状态 */}
      <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.1 }}>
        <Card className="h-full">
        <CardContent className="p-6 h-full flex items-center">
          <div className="flex items-center justify-between w-full">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                运行状态
              </p>
              <Badge
                variant={stats.is_running ? "default" : "outline"}
                className="mt-2"
              >
                {stats.is_running ? (
                  <>
                    <Activity className="mr-1 h-3 w-3 animate-pulse" />
                    运行中
                  </>
                ) : (
                  <>
                    <Clock className="mr-1 h-3 w-3" />
                    空闲
                  </>
                )}
              </Badge>
            </div>
            <Activity className="h-8 w-8 text-green-500" />
          </div>
        </CardContent>
      </Card>
      </motion.div>

      {/* 磁盘使用率 */}
      <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.1 }}>
        <Card className="h-full">
        <CardContent className="p-6 h-full flex items-center">
          <div className="flex items-center justify-between w-full">
            <div>
              <p className="text-sm font-medium text-muted-foreground font-mono">
                磁盘使用率
              </p>
              <p className="text-2xl font-bold font-mono mt-2">
                {stats.disk_usage_percent !== undefined && stats.disk_usage_percent !== null
                  ? `${stats.disk_usage_percent.toFixed(1)}%`
                  : "N/A"}
              </p>
            </div>
            <HardDrive className="h-8 w-8 text-purple-500" />
          </div>
        </CardContent>
      </Card>
      </motion.div>

      {/* 运行时间 - 紧凑版 */}
      <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.1 }}>
        <Card className="h-full">
        <CardContent className="p-6 h-full flex flex-col justify-center">
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground font-mono">
              运行时间
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">上次</span>
                <span className="font-mono">{formatDate(stats.last_run)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">下次</span>
                <span className="font-mono">{formatDate(stats.next_run)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </motion.div>
    </div>
  );
}
