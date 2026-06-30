"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/common/section-card";
import { formatBytes } from "@/lib/formatters";
import type { DryRunResult } from "@/lib/types";

interface DryRunResultsProps {
  result: DryRunResult;
  onClose: () => void;
}

export function DryRunResults({ result, onClose }: DryRunResultsProps) {
  const downloadBudgetBytes = result.download_budget_bytes;
  const activeDownloadRemainingBytes = result.active_download_remaining_bytes;
  const hasDownloadBudgetBytes =
    typeof downloadBudgetBytes === "number" &&
    Number.isFinite(downloadBudgetBytes);
  const hasActiveDownloadRemainingBytes =
    typeof activeDownloadRemainingBytes === "number" &&
    Number.isFinite(activeDownloadRemainingBytes);
  const isBudgetGated =
    result.download_candidates.length === 0 && (result.skipped_budget ?? 0) > 0;
  const hasDownloadBudgetDetails =
    hasDownloadBudgetBytes || hasActiveDownloadRemainingBytes;

  return (
    <SectionCard
      title="模拟运行结果"
      action={
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="关闭模拟结果"
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      }
      contentClassName="grid gap-6 p-4 lg:grid-cols-2"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">下载候选</h3>
          <Badge variant="secondary">
            {result.download_candidates.length} /{" "}
            {result.total_download_candidates}
          </Badge>
        </div>
        {hasDownloadBudgetDetails ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-xs">
            {hasDownloadBudgetBytes ? (
              <span>剩余预算 {formatBytes(downloadBudgetBytes)}</span>
            ) : null}
            {hasActiveDownloadRemainingBytes ? (
              <span>未完成预留 {formatBytes(activeDownloadRemainingBytes)}</span>
            ) : null}
          </div>
        ) : null}
        {result.download_candidates.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {isBudgetGated
              ? "下载预算已耗尽或不足，跳过符合条件的种子"
              : "没有符合条件的种子"}
          </p>
        ) : (
          <div className="space-y-2">
            {result.download_candidates.map((candidate, idx) => (
              <div key={candidate.id} className="rounded-xl border p-3">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <Badge variant="outline">#{idx + 1}</Badge>
                  <Badge variant="secondary">
                    {candidate.score.toFixed(1)}
                  </Badge>
                  <Badge variant="outline">
                    {candidate.size_gb.toFixed(2)} GB
                  </Badge>
                </div>
                <p className="truncate text-sm font-medium">{candidate.name}</p>
                <p className="mt-1 text-muted-foreground text-xs">
                  {candidate.reason}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">清理候选</h3>
          <Badge variant="secondary">{result.cleanup_candidates.length}</Badge>
        </div>
        {result.cleanup_candidates.length === 0 ? (
          <p className="text-muted-foreground text-sm">没有需要清理的种子</p>
        ) : (
          <div className="space-y-2">
            {result.cleanup_candidates.map((candidate) => (
              <div key={candidate.hash} className="rounded-xl border p-3">
                <Badge variant="outline">
                  分享率 {candidate.ratio.toFixed(2)}
                </Badge>
                <p className="mt-2 truncate text-sm font-medium">
                  {candidate.name}
                </p>
                <p className="mt-1 text-muted-foreground text-xs">
                  {candidate.reason}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
