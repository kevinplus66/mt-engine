/**
 * 全局运行状态 Hook - 供顶栏状态徽标使用
 * 轮询 /api/status，失败时静默（不触发全局错误 toast）
 */

import useSWR from "swr";
import { getRuntimeStatus } from "@/lib/api";
import type { RuntimeStatus } from "@/lib/types";

export type RuntimeHealth = "live" | "stale" | "offline";

const RUNTIME_STATUS_REFRESH_MS = 60_000;

function resolveHealth(
  data: RuntimeStatus | undefined,
  error: unknown,
): RuntimeHealth | null {
  if (error) return "offline";
  if (!data) return null;

  const hasStaleCache = Boolean(data.cache?.stale);
  const hasStaleCollector = Boolean(data.panel_collector?.stale);
  const hasWarnings = (data.warnings?.length ?? 0) > 0;
  return hasStaleCache || hasStaleCollector || hasWarnings ? "stale" : "live";
}

export function useRuntimeStatus() {
  const { data, error, isLoading } = useSWR<RuntimeStatus>(
    "/api/status",
    () => getRuntimeStatus(),
    {
      refreshInterval: RUNTIME_STATUS_REFRESH_MS,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      onError: () => {},
    },
  );

  return { data, error, isLoading, health: resolveHealth(data, error) };
}
