"use client";

import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Search, Waves } from "lucide-react";
import { StatusTabs } from "@/components/sonar/status-tabs";
import { FilterPills, type SizeFilter, type SeederFilter } from "@/components/sonar/filter-pills";
import { DropdownFilters, type RemainingFilter, type ModeFilter } from "@/components/sonar/dropdown-filters";
import { TorrentList } from "@/components/sonar/torrent-list";
import { PageTransition } from "@/components/common/page-transition";
import { useSonarTorrents } from "@/hooks/use-sonar-torrents";
import { useSortable } from "@/hooks/use-sortable";
import { sortData, torrentSortExtractors } from "@/lib/sort-utils";
import { refreshTorrents } from "@/lib/api";
import { toast } from "sonner";
import type { Torrent } from "@/lib/types";
import { useDebounce } from "@/hooks/use-debounce";

type UserStatus = "all" | "seeding" | "leeching" | "none";
type SonarSortField = "name" | "size" | "seeders" | "remaining";

function SonarPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: torrents, isLoading, error, mutate } = useSonarTorrents();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // URL state helpers
  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all" || value === "") {
        params.delete(name);
      } else {
        params.set(name, value);
      }
      return params.toString();
    },
    [searchParams]
  );

  const updateParam = (name: string, value: string) => {
    router.replace(`?${createQueryString(name, value)}`, { scroll: false });
  };

  // State from URL with defaults
  const statusFilter = (searchParams.get("status") as UserStatus) || "all";
  const sizeFilter = (searchParams.get("size") as SizeFilter) || "all";
  const seederFilter = (searchParams.get("seeders") as SeederFilter) || "all";
  const remainingFilter = (searchParams.get("remaining") as RemainingFilter) || "all";
  const modeFilter = (searchParams.get("mode") as ModeFilter) || "all";
  
  // Search state handling
  const searchParam = searchParams.get("q") || "";
  const [searchValue, setSearchValue] = useState(searchParam);
  const debouncedSearch = useDebounce(searchValue, 300);

  // Sync debounced search to URL
  useEffect(() => {
    if (debouncedSearch !== searchParam) {
      updateParam("q", debouncedSearch);
    }
  }, [debouncedSearch, searchParam, createQueryString]);

  // Keep local input in sync if URL changes externally
  useEffect(() => {
    if (searchParam !== searchValue) {
      setSearchValue(searchParam);
    }
  }, [searchParam]);

  // Sorting state - default to remaining time ascending (critical first)
  const {
    sortField,
    sortDirection,
    handleSort,
    getSortDirection,
  } = useSortable<SonarSortField>({
    defaultField: "remaining",
    defaultDirection: "asc", // ascending = shortest remaining time first
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshTorrents();
      await mutate();
      toast.success("刷新成功");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "刷新失败");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleReset = () => {
    router.replace("/sonar", { scroll: false });
    setSearchValue("");
  };

  // 过滤逻辑
  const filteredTorrents = torrents?.filter((torrent: Torrent) => {
    // 状态过滤
    if (statusFilter !== "all" && torrent.user_status !== statusFilter) {
      return false;
    }

    // 关键词搜索
    if (debouncedSearch && !torrent.name.toLowerCase().includes(debouncedSearch.toLowerCase())) {
      return false;
    }

    // 大小过滤
    const sizeGB = torrent.size / (1024 ** 3);
    if (sizeFilter === "small" && sizeGB >= 10) return false;
    if (sizeFilter === "medium" && (sizeGB < 10 || sizeGB >= 50)) return false;
    if (sizeFilter === "large" && (sizeGB < 50 || sizeGB >= 100)) return false;
    if (sizeFilter === "xlarge" && sizeGB < 100) return false;

    // 做种数过滤
    if (seederFilter === "hot" && torrent.seeders <= 10) return false;
    if (seederFilter === "normal" && (torrent.seeders < 5 || torrent.seeders > 10)) return false;
    if (seederFilter === "rare" && (torrent.seeders < 1 || torrent.seeders > 5)) return false;
    if (seederFilter === "dead" && torrent.seeders !== 0) return false;

    // 剩余时间过滤
    if (remainingFilter !== "all" && torrent.remaining) {
      const hours = torrent.remaining.hours || 0;
      if (remainingFilter === "critical" && hours >= 1) return false;
      if (remainingFilter === "danger" && (hours < 1 || hours >= 2)) return false;
      if (remainingFilter === "warning" && (hours < 2 || hours >= 6)) return false;
      if (remainingFilter === "safe" && (hours < 6 || hours >= 24)) return false;
      if (remainingFilter === "plenty" && hours < 24) return false;
    }

    // 频道过滤
    if (modeFilter === "normal" && torrent.mode === "adult") return false;
    if (modeFilter === "adult" && torrent.mode !== "adult") return false;

    return true;
  });

  // Apply sorting to filtered torrents
  const sortedTorrents = useMemo(() => {
    if (!filteredTorrents) return [];
    return sortData(filteredTorrents, sortField, sortDirection, torrentSortExtractors);
  }, [filteredTorrents, sortField, sortDirection]);

  return (
    <PageTransition>
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
        {/* 标题 */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <span>SONAR</span>
            <span className="text-base font-normal text-muted-foreground">· 免费种子监控</span>
          </h1>
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            variant="outline"
            className="w-full sm:w-auto min-h-[44px]"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            手动刷新
          </Button>
        </div>

        {/* 控制栏 */}
        <Card className="p-6 space-y-4">
          {/* 第一行：搜索栏 */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                type="text"
                name="search"
                autoComplete="off"
                placeholder="搜索种子名称..."
                aria-label="搜索种子"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" onClick={handleReset}>
              重置
            </Button>
          </div>

          {/* 第二行：状态标签 */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <StatusTabs 
              status={statusFilter} 
              onStatusChange={(val) => updateParam("status", val)} 
            />
          </div>

          {/* 第三行：快速过滤按钮 */}
          <FilterPills
            sizeFilter={sizeFilter}
            seederFilter={seederFilter}
            onSizeChange={(val) => updateParam("size", val)}
            onSeederChange={(val) => updateParam("seeders", val)}
          />

          {/* 第四行：下拉过滤器 */}
          <DropdownFilters
            remainingFilter={remainingFilter}
            modeFilter={modeFilter}
            onRemainingChange={(val) => updateParam("remaining", val)}
            onModeChange={(val) => updateParam("mode", val)}
          />

          {/* 统计信息 */}
          {torrents && (
            <div className="text-sm text-muted-foreground">
              共 <strong>{sortedTorrents?.length || 0}</strong> 个种子
              {sortedTorrents?.length !== torrents.length && (
                <span className="ml-2">
                  （筛选自 {torrents.length} 个）
                </span>
              )}
            </div>
          )}
        </Card>

        {/* 种子列表 */}
        {error && (
          <Card className="p-6 text-center text-red-600">
            加载失败：{error.message}
          </Card>
        )}

        {isLoading && (
          <Card className="p-12 text-center">
            <div className="text-6xl mb-4">⏳</div>
            <p className="text-muted-foreground">加载中...</p>
          </Card>
        )}

        {!isLoading && !error && sortedTorrents && (
          <TorrentList
            torrents={sortedTorrents}
            onSort={(field) => handleSort(field as SonarSortField)}
            getSortDirection={(field) => getSortDirection(field as SonarSortField)}
          />
        )}

        {!isLoading && !error && sortedTorrents?.length === 0 && (
          <Card className="p-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-6 bg-gray-100 dark:bg-zinc-900 rounded-full border-4 border-gray-200 dark:border-zinc-800">
                <Waves className="h-16 w-16 text-gray-400 dark:text-gray-500 animate-pulse" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-2">暂无种子</h3>
            <p className="text-muted-foreground">
              {statusFilter === "all"
                ? "当前没有免费种子"
                : "当前筛选条件下没有种子"}
            </p>
          </Card>
        )}
        </div>
      </div>
    </PageTransition>
  );
}

export default function SonarPage() {
  return (
    <Suspense fallback={
      <PageTransition>
        <div className="container mx-auto p-6 space-y-6">
          <Card className="p-12 text-center">
            <div className="text-6xl mb-4">⏳</div>
            <p className="text-muted-foreground">加载中...</p>
          </Card>
        </div>
      </PageTransition>
    }>
      <SonarPageContent />
    </Suspense>
  );
}
