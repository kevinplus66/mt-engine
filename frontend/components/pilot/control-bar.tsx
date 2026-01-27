/**
 * ControlBar - PILOT 控制栏
 * 显示快速状态和 Toggle 开关（不包含操作按钮，避免与页面主要功能重叠）
 */

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
      <CardContent className="p-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* 左侧：快速状态 */}
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-mono">活动任务</span>
              <Badge variant="outline" className="font-mono">
                {stats?.active_tasks ?? 0}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-mono">待下载</span>
              <Badge variant="outline" className="font-mono">
                {stats?.pending_downloads ?? 0}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">下载状态</span>
              <Badge variant={config?.download.enabled ? "default" : "outline"}>
                {config?.download.enabled ? "已启用" : "已禁用"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">清理状态</span>
              <Badge variant={config?.cleanup.enabled ? "default" : "outline"}>
                {config?.cleanup.enabled ? "已启用" : "已禁用"}
              </Badge>
            </div>
          </div>

          {/* 右侧：Toggle 开关 */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="download-enabled"
                checked={config?.download.enabled ?? false}
                onCheckedChange={onDownloadToggle}
                disabled={isLoading}
              />
              <Label htmlFor="download-enabled" className="cursor-pointer text-sm">
                启用下载
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="cleanup-enabled"
                checked={config?.cleanup.enabled ?? false}
                onCheckedChange={onCleanupToggle}
                disabled={isLoading}
              />
              <Label htmlFor="cleanup-enabled" className="cursor-pointer text-sm">
                启用清理
              </Label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
