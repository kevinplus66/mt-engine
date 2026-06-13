/**
 * PILOT - 配置管理 Hook
 */

import useSWR from "swr";
import { getPilotConfig, savePilotConfig } from "@/lib/api";
import { parsePilotConfig } from "@/lib/pilot-schema";
import type { AutomationConfig } from "@/lib/types";

async function pilotConfigFetcher() {
  return parsePilotConfig(await getPilotConfig());
}

export function usePilotConfig() {
  const swr = useSWR<AutomationConfig>(
    "/api/pilot/config",
    pilotConfigFetcher
  );

  const saveConfig = async (config: AutomationConfig) => {
    await savePilotConfig(parsePilotConfig(config));
    // 重新验证数据
    await swr.mutate();
  };

  return {
    ...swr,
    saveConfig,
  };
}
