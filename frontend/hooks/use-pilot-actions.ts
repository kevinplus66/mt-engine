"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";
import { dryRunPilot, triggerCleanup, triggerDownload } from "@/lib/api";
import type { DryRunResult } from "@/lib/types";

export function usePilotActions() {
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);

  const handleDryRun = async () => {
    setIsDryRunning(true);
    try {
      const result = await dryRunPilot();
      setDryRunResult(result);
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

  return {
    dryRunResult,
    setDryRunResult,
    isDryRunning,
    isDownloading,
    isCleaning,
    handleDryRun,
    handleDownload,
    handleCleanup,
  };
}
