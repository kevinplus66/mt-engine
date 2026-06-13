"use client";

import { useState } from "react";
import {
  AlertCircle,
  Navigation,
  Play,
  RotateCcw,
  Save,
  TestTube,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageScaffold } from "@/components/common/page-scaffold";
import { StateCard } from "@/components/common/state-card";
import { ConfigForm } from "@/components/pilot/config-form";
import { ControlBar } from "@/components/pilot/control-bar";
import { DryRunResults } from "@/components/pilot/dry-run-results";
import { StatsBar } from "@/components/pilot/stats-bar";
import { usePilotActions } from "@/hooks/use-pilot-actions";
import { usePilotConfig } from "@/hooks/use-pilot-config";
import { usePilotConfigEditor } from "@/hooks/use-pilot-config-editor";
import { usePilotStats } from "@/hooks/use-pilot-stats";

export default function PilotPage() {
  const {
    data: config,
    isLoading: configLoading,
    error: configError,
    saveConfig,
  } = usePilotConfig();
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = usePilotStats();
  const {
    editedConfig,
    validationErrors,
    configSections,
    setConfigSections,
    isSaving,
    isConfigDirty,
    handleConfigChange,
    handleSave,
    handleReset,
    handleDownloadToggle,
    handleCleanupToggle,
  } = usePilotConfigEditor({ config, saveConfig });
  const {
    dryRunResult,
    setDryRunResult,
    isDryRunning,
    isDownloading,
    isCleaning,
    handleDryRun,
    handleDownload,
    handleCleanup,
  } = usePilotActions();

  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const requestReset = () => {
    if (isConfigDirty) {
      setResetDialogOpen(true);
      return;
    }

    handleReset();
  };

  const confirmReset = () => {
    handleReset();
    setResetDialogOpen(false);
  };

  const confirmCleanup = async () => {
    await handleCleanup();
    setCleanupDialogOpen(false);
  };

  return (
    <>
      <PageScaffold
      eyebrow="PILOT"
      title="自动化配置"
      description="下载策略、清理策略和运行状态集中配置。"
      icon={Navigation}
      actions={
        <>
          <Button
            onClick={handleDryRun}
            disabled={!editedConfig}
            loading={isDryRunning}
            variant="outline"
          >
            <TestTube className="size-4" aria-hidden="true" />
            模拟运行
          </Button>
          <Button
            onClick={handleDownload}
            loading={isDownloading}
            variant="outline"
          >
            <Play className="size-4" aria-hidden="true" />
            触发下载
          </Button>
          <Button
            onClick={() => setCleanupDialogOpen(true)}
            loading={isCleaning}
            variant="destructive-outline"
          >
            <Play className="size-4" aria-hidden="true" />
            触发清理
          </Button>
        </>
      }
      meta={
        stats && (
          <>
            <Badge variant={stats.is_running ? "success" : "secondary"}>
              {stats.is_running ? "运行中" : "空闲"}
            </Badge>
            <Badge variant="outline">活跃 {stats.active_tasks}</Badge>
          </>
        )
      }
    >
      {configError && (
        <Alert variant="error">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertTitle>配置加载失败</AlertTitle>
          <AlertDescription>
            <span>{configError.message}</span>{" "}
            <span>请检查配置接口与后端连接后重试。</span>
          </AlertDescription>
        </Alert>
      )}

      {statsError && (
        <Alert variant="error">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertTitle>运行统计加载失败</AlertTitle>
          <AlertDescription>
            <span>{statsError.message}</span>{" "}
            <span>请稍后重试，或检查 Pilot 运行统计接口状态。</span>
          </AlertDescription>
        </Alert>
      )}

      {editedConfig && (
        <ControlBar
          stats={stats}
          config={editedConfig}
          onDownloadToggle={handleDownloadToggle}
          onCleanupToggle={handleCleanupToggle}
          isLoading={configLoading}
        />
      )}

      {statsLoading && (
        <StateCard
          icon={Navigation}
          iconClassName="motion-safe:animate-pulse"
          title="加载运行统计"
          description="正在读取 PILOT 运行状态…"
        />
      )}

      {stats && <StatsBar stats={stats} />}

      {dryRunResult && (
        <DryRunResults
          result={dryRunResult}
          onClose={() => setDryRunResult(null)}
        />
      )}

      {configLoading && (
        <StateCard
          icon={Navigation}
          iconClassName="motion-safe:animate-pulse"
          title="加载配置"
          description="正在读取 PILOT 运行参数…"
        />
      )}

      {!configLoading && editedConfig && (
        <>
          <ConfigForm
            config={editedConfig}
            errors={validationErrors}
            openSections={configSections}
            onOpenSectionsChange={setConfigSections}
            onConfigChange={handleConfigChange}
          />
          <Card>
            <CardContent className="flex flex-col items-stretch gap-2 p-4 sm:flex-row sm:items-center sm:justify-end">
              {isConfigDirty && (
                <Badge variant="warning" className="sm:mr-auto">
                  有未保存的修改
                </Badge>
              )}
              <Button
                onClick={requestReset}
                variant="outline"
                disabled={isSaving || !isConfigDirty}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                重置
              </Button>
              <Button
                onClick={handleSave}
                disabled={!isConfigDirty}
                loading={isSaving}
              >
                <Save className="size-4" aria-hidden="true" />
                保存配置
              </Button>
            </CardContent>
          </Card>
        </>
      )}
      </PageScaffold>
      <AlertDialog
        open={cleanupDialogOpen}
        onOpenChange={(open) => {
          if (!isCleaning) setCleanupDialogOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认触发清理</AlertDialogTitle>
            <AlertDialogDescription>
              清理会按当前已保存的清理规则处理符合条件的任务。确认要立即触发清理吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" disabled={isCleaning} />}>
              取消
            </AlertDialogClose>
            <Button
              variant="destructive"
              onClick={confirmCleanup}
              loading={isCleaning}
            >
              确认清理
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>放弃未保存的修改？</AlertDialogTitle>
            <AlertDialogDescription>
              重置会丢弃当前表单里的未保存编辑，并恢复为最近一次保存的配置。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>
              继续编辑
            </AlertDialogClose>
            <Button variant="destructive-outline" onClick={confirmReset}>
              放弃修改
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
