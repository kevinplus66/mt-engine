/**
 * SONAR - 自动删除状态 Hook
 */

import useSWR from "swr";
import { toggleAutoDelete } from "@/lib/api";
import type { AutoDeleteStatus } from "@/lib/types";

export function useAutoDelete() {
  const swr = useSWR<AutoDeleteStatus>("/api/auto-delete/status");

  const toggle = async (enabled: boolean) => {
    await toggleAutoDelete(enabled);
    // 重新验证数据
    await swr.mutate();
  };

  return {
    ...swr,
    toggle,
  };
}
