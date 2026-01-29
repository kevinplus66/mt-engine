"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatsBar } from "@/components/pilot/stats-bar";
import { ControlBar } from "@/components/pilot/control-bar";
import { ConfigForm } from "@/components/pilot/config-form";
import { PageTransition } from "@/components/common/page-transition";
import { usePilotConfig } from "@/hooks/use-pilot-config";
import { usePilotStats } from "@/hooks/use-pilot-stats";
import { dryRunPilot, triggerDownload, triggerCleanup } from "@/lib/api";
import { toast } from "sonner";
import { Play, RotateCcw, Save, TestTube, X } from "lucide-react";
import type { AutomationConfig } from "@/lib/types";

interface DryRunResult {
  download_candidates: Array<{
    id: string;
    name: string;
    size_gb: number;
    score: number;
    reason: string;
  }>;
  total_download_candidates: number;
  cleanup_candidates: Array<{
    name: string;
    hash: string;
    ratio: number;
    reason: string;
  }>;
  total_cleanup_candidates: number;
}

export default function PilotPage() {
  const { data: config, isLoading: configLoading, saveConfig } = usePilotConfig();
  const { data: stats, isLoading: statsLoading } = usePilotStats();

  const [editedConfig, setEditedConfig] = useState<AutomationConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);

  // 初始化编辑配置
  useEffect(() => {
    if (config && !editedConfig) {
      setEditedConfig(config);
    }
  }, [config, editedConfig]);

  const handleSave = async () => {
    if (!editedConfig) return;

    setIsSaving(true);
    try {
      await saveConfig(editedConfig);
      toast.success("配置保存成功");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (config) {
      setEditedConfig(config);
      toast.success("已重置为当前配置");
    }
  };

  const handleDryRun = async () => {
    setIsDryRunning(true);
    try {
      const result = await dryRunPilot();
      setDryRunResult(result as DryRunResult);
      toast.success("模拟运行完成");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "模拟运行失败");
    } finally {
      setIsDryRunning(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await triggerDownload();
      toast.success("下载任务触发成功");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "触发失败");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCleanup = async () => {
    setIsCleaning(true);
    try {
      await triggerCleanup();
      toast.success("清理任务触发成功");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "触发失败");
    } finally {
      setIsCleaning(false);
    }
  };

  const handleDownloadToggle = async (enabled: boolean) => {
    if (!editedConfig) return;
    const newConfig = {
      ...editedConfig,
      download: {
        ...editedConfig.download,
        enabled,
      },
    };
    setEditedConfig(newConfig);
    await saveConfigQuietly(newConfig);
  };

  const handleCleanupToggle = async (enabled: boolean) => {
    if (!editedConfig) return;
    const newConfig = {
      ...editedConfig,
      cleanup: {
        ...editedConfig.cleanup,
        enabled,
      },
    };
    setEditedConfig(newConfig);
    await saveConfigQuietly(newConfig);
  };

  const saveConfigQuietly = async (configToSave: AutomationConfig) => {
    try {
      await saveConfig(configToSave);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    }
  };

  const isLoading = configLoading || statsLoading;

  return (
    <PageTransition>
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
        {/* 标题 */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <span>PILOT</span>
            <span className="text-base font-normal text-muted-foreground">· 自动化配置</span>
          </h1>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={handleDryRun}
              disabled={isDryRunning || !editedConfig}
              variant="outline"
              className="w-full sm:w-auto min-h-[44px]"
            >
              <TestTube className="mr-2 h-4 w-4" />
              模拟运行
            </Button>
            <Button
              onClick={handleDownload}
              disabled={isDownloading}
              variant="outline"
              className="w-full sm:w-auto min-h-[44px]"
            >
              <Play className="mr-2 h-4 w-4" />
              触发下载
            </Button>
            <Button
              onClick={handleCleanup}
              disabled={isCleaning}
              variant="outline"
              className="w-full sm:w-auto min-h-[44px]"
            >
              <Play className="mr-2 h-4 w-4" />
              触发清理
            </Button>
          </div>
        </div>

        {/* 控制栏 */}
        {stats && editedConfig && (
          <ControlBar
            stats={stats}
            config={editedConfig}
            onDownloadToggle={handleDownloadToggle}
            onCleanupToggle={handleCleanupToggle}
            isLoading={isLoading}
          />
        )}

        {/* 统计信息 */}
        {stats && <StatsBar stats={stats} />}

        {/* 模拟运行结果 */}
        {dryRunResult && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>模拟运行结果</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDryRunResult(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 下载候选 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    下载候选 ({dryRunResult.download_candidates.length} / {dryRunResult.total_download_candidates})
                  </h3>
                </div>
                {dryRunResult.download_candidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    没有符合条件的种子
                  </p>
                ) : (
                  <div className="space-y-2">
                    {dryRunResult.download_candidates.map((candidate, idx) => (
                      <div
                        key={candidate.id}
                        className="p-3 border rounded-lg space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline">#{idx + 1}</Badge>
                              <Badge variant="secondary">
                                评分: {candidate.score.toFixed(1)}
                              </Badge>
                              <Badge variant="outline">
                                {candidate.size_gb.toFixed(2)} GB
                              </Badge>
                            </div>
                            <p className="text-sm font-medium truncate">
                              {candidate.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {candidate.reason}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 清理候选 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    清理候选 ({dryRunResult.cleanup_candidates.length})
                  </h3>
                </div>
                {dryRunResult.cleanup_candidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    没有需要清理的种子
                  </p>
                ) : (
                  <div className="space-y-2">
                    {dryRunResult.cleanup_candidates.map((candidate) => (
                      <div
                        key={candidate.hash}
                        className="p-3 border rounded-lg space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline">
                                分享率: {candidate.ratio.toFixed(2)}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium truncate">
                              {candidate.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {candidate.reason}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 配置表单 */}
        {isLoading && (
          <Card className="p-12 text-center">
            <div className="text-6xl mb-4">⏳</div>
            <p className="text-muted-foreground">加载配置中...</p>
          </Card>
        )}

        {!isLoading && editedConfig && (
          <>
            <ConfigForm
              config={editedConfig}
              onConfigChange={setEditedConfig}
            />

            {/* 操作按钮 */}
            <Card className="p-6">
              <div className="flex justify-end gap-3">
                <Button
                  onClick={handleReset}
                  variant="outline"
                  disabled={isSaving}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  重置
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "保存中..." : "保存配置"}
                </Button>
              </div>
            </Card>
          </>
        )}
        </div>
      </div>
    </PageTransition>
  );
}
