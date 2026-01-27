/**
 * PILOT - 配置管理 Hook
 */

import useSWR from "swr";
import { savePilotConfig } from "@/lib/api";
import type { AutomationConfig } from "@/lib/types";

export function usePilotConfig() {
  const swr = useSWR<AutomationConfig>("/api/pilot/config");

  const saveConfig = async (config: AutomationConfig) => {
    await savePilotConfig(config);
    // 重新验证数据
    await swr.mutate();
  };

  return {
    ...swr,
    saveConfig,
  };
}
