/**
 * ControlBar - PILOT 控制栏
 * 显示快速状态和 Toggle 开关（不包含操作按钮，避免与页面主要功能重叠）
 */

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AutoDeleteToggle } from "@/components/pilot/auto-delete-toggle";
import type { PilotStats, AutomationConfig } from "@/lib/types";

interface ControlBarProps {
  stats: PilotStats | undefined;
  config: AutomationConfig | undefined;
  onDownloadToggle: (enabled: boolean) => void;
  onCleanupToggle: (enabled: boolean) => void;
  isLoading?: boolean;
}

export function ControlBar({
  stats,
  config,
  onDownloadToggle,
  onCleanupToggle,
  isLoading = false,
}: ControlBarProps) {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* 左侧：快速状态 - 移动端 2x2 网格，桌面端横向排列 */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 lg:flex lg:gap-8 w-full lg:w-auto">
            <div className="flex flex-row items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap w-[4.5rem]">活动任务</span>
              <Badge variant="outline" className="tabular-nums h-6 px-2 min-w-[2rem] justify-center bg-background">
                {stats?.active_tasks ?? 0}
              </Badge>
            </div>
            <div className="flex flex-row items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap w-[4.5rem]">待下载</span>
              <Badge variant="outline" className="tabular-nums h-6 px-2 min-w-[2rem] justify-center bg-background">
                {stats?.pending_downloads ?? 0}
              </Badge>
            </div>
            <div className="flex flex-row items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap w-[4.5rem]">下载状态</span>
              <Badge 
                variant={config?.download.enabled ? "success" : "secondary"} 
                className="h-6 px-2 w-fit justify-center"
              >
                {config?.download.enabled ? "已启用" : "已禁用"}
              </Badge>
            </div>
            <div className="flex flex-row items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap w-[4.5rem]">清理状态</span>
              <Badge 
                variant={config?.cleanup.enabled ? "success" : "secondary"}
                className="h-6 px-2 w-fit justify-center"
              >
                {config?.cleanup.enabled ? "已启用" : "已禁用"}
              </Badge>
            </div>
          </div>

          {/* 分隔线 - 仅移动端显示 */}
          <Separator className="lg:hidden" />

          {/* 右侧：Toggle 开关 - 移动端 Grid，桌面端 Flex */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 lg:flex lg:items-center lg:gap-8 w-full lg:w-auto">
            <div className="flex items-center space-x-3">
              <AutoDeleteToggle />
            </div>
            <div className="flex items-center space-x-3">
              <Switch
                id="download-enabled"
                checked={config?.download.enabled ?? false}
                onCheckedChange={onDownloadToggle}
                disabled={isLoading}
              />
              <Label htmlFor="download-enabled" className="cursor-pointer text-sm font-medium whitespace-nowrap">
                启用下载
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <Switch
                id="cleanup-enabled"
                checked={config?.cleanup.enabled ?? false}
                onCheckedChange={onCleanupToggle}
                disabled={isLoading}
              />
              <Label htmlFor="cleanup-enabled" className="cursor-pointer text-sm font-medium whitespace-nowrap">
                启用清理
              </Label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
