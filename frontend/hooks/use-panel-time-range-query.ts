"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DEFAULT_PANEL_TIME_RANGE,
  parsePanelTimeRange,
  type PanelTimeRange,
} from "@/lib/panel-view";

export function usePanelTimeRangeQuery() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const queryTimeRange = useMemo(() => {
    const params = new URLSearchParams(queryString);
    return parsePanelTimeRange(params.get("range") ?? params.get("timeRange"));
  }, [queryString]);
  const [timeRange, setTimeRange] = useState<PanelTimeRange>(queryTimeRange);

  useEffect(() => {
    setTimeRange(queryTimeRange);
  }, [queryTimeRange]);

  const setPanelTimeRange = useCallback(
    (value: PanelTimeRange) => {
      const nextRange = parsePanelTimeRange(value);
      setTimeRange(nextRange);

      const params = new URLSearchParams(searchParams.toString());
      params.delete("timeRange");
      if (nextRange === DEFAULT_PANEL_TIME_RANGE) {
        params.delete("range");
      } else {
        params.set("range", nextRange);
      }

      const nextQuery = params.toString();
      router.replace(nextQuery ? `?${nextQuery}` : "/panel", {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  return { timeRange, setPanelTimeRange };
}
