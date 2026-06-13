"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  isStatusFilter,
  MONITOR_STATUS_QUERY_PARAM,
  type StatusFilter,
} from "@/lib/panel-torrents";

export function usePanelMonitorQuery() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const rawQueryStatusFilter = searchParams.get(MONITOR_STATUS_QUERY_PARAM);
  const queryStatusFilter = isStatusFilter(rawQueryStatusFilter)
    ? rawQueryStatusFilter
    : "all";

  useEffect(() => {
    setStatusFilter(queryStatusFilter);
  }, [queryStatusFilter]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const setStatusFilterParam = useCallback(
    (nextStatus: StatusFilter) => {
      setStatusFilter(nextStatus);

      const params = new URLSearchParams(searchParams.toString());
      if (nextStatus === "all") {
        params.delete(MONITOR_STATUS_QUERY_PARAM);
      } else {
        params.set(MONITOR_STATUS_QUERY_PARAM, nextStatus);
      }

      const nextQuery = params.toString();
      router.replace(nextQuery ? `?${nextQuery}` : "/panel", {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  return {
    statusFilter,
    setStatusFilter: setStatusFilterParam,
    page,
    setPage,
  };
}
