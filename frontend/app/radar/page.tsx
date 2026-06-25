"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useRef } from "react";
import { AlertCircle, Radar, Search } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageScaffold } from "@/components/common/page-scaffold";
import { SearchResetBar } from "@/components/common/search-reset-bar";
import { SectionCard } from "@/components/common/section-card";
import {
  SegmentedControl,
  type SegmentedControlOption,
} from "@/components/common/segmented-control";
import { StateCard } from "@/components/common/state-card";
import { CategoryPills } from "@/components/radar/category-pills";
import { FilterSelects } from "@/components/radar/filter-selects";
import { useRadarQueryState } from "@/hooks/use-radar-query-state";
import { useRadarSearch } from "@/hooks/use-radar-search";
import { buildRadarSearchRequest, type RadarSortField } from "@/lib/radar-view";
import type { SortDirection } from "@/hooks/use-sortable";
import type { SearchMode, Torrent } from "@/lib/types";

const RADAR_MODE_OPTIONS: readonly SegmentedControlOption<SearchMode>[] = [
  { value: "normal", label: "综合" },
  { value: "movie", label: "电影" },
  { value: "tvshow", label: "电视剧" },
  { value: "other", label: "其他" },
  { value: "adult", label: "成人", className: "text-destructive" },
];

type RadarTorrentTableProps = {
  torrents: Torrent[];
  total: number;
  isLoading?: boolean;
  onSort?: (field: string) => void;
  getSortDirection?: (field: string) => SortDirection | null;
};

function RadarResultsFallback() {
  return (
    <StateCard
      icon={Search}
      iconClassName="motion-safe:animate-pulse motion-reduce:opacity-70"
      title="加载搜索结果…"
      description="正在载入结果列表…"
    />
  );
}

const TorrentTable = dynamic<RadarTorrentTableProps>(
  () =>
    import("@/components/radar/torrent-table").then(
      (module) => module.TorrentTable,
    ),
  { loading: RadarResultsFallback },
);

function RadarPageContent() {
  const {
    keyword,
    mode,
    selectedCategories,
    filters,
    sortField,
    sortDirection,
    currentState,
    handleKeywordChange,
    handleModeChange,
    handleCategoriesChange,
    handleFiltersChange,
    setSort,
    resetQueryState,
  } = useRadarQueryState();
  const {
    trigger,
    data,
    isMutating,
    error,
    reset: resetRadarSearch,
  } = useRadarSearch();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 卸载时清掉待执行的防抖搜索，避免离开页面后仍触发 M-Team 请求
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const handleSearch = async (
    overrides: Partial<
      Pick<typeof currentState, "sortField" | "sortDirection">
    > = {},
  ) => {
    resetRadarSearch();
    await trigger(buildRadarSearchRequest({ ...currentState, ...overrides }));
  };

  const debouncedSearch = (
    sortOverrides: Partial<
      Pick<typeof currentState, "sortField" | "sortDirection">
    > = {},
  ) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(sortOverrides);
    }, 300);
  };

  const handleReset = () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    resetRadarSearch();
    resetQueryState();
  };

  const handleSortChange = (field: RadarSortField) => {
    const nextDirection =
      sortField === field && sortDirection === "desc" ? "asc" : "desc";
    setSort(field, nextDirection);
    debouncedSearch({ sortField: field, sortDirection: nextDirection });
  };

  const getSortDirection = (field: RadarSortField) => {
    return sortField === field ? sortDirection : null;
  };

  return (
    <PageScaffold
      eyebrow="RADAR"
      title="种子搜索"
      description="按关键词、频道、分类和媒体参数组合检索 M-Team。"
      icon={Radar}
    >
      <SectionCard title="搜索条件" contentClassName="space-y-5 p-4 sm:p-5">
        <SearchResetBar
          value={keyword}
          onValueChange={handleKeywordChange}
          onSearch={() => handleSearch()}
          onReset={handleReset}
          isLoading={isMutating}
          placeholder="输入关键词，如 2160p H.265…"
          searchLabel={isMutating ? "搜索中…" : "搜索"}
          showSearchButton
        />
        <SegmentedControl
          ariaLabel="搜索模式"
          className="w-full"
          itemClassName="min-w-0 flex-1"
          fullWidth
          value={mode}
          options={RADAR_MODE_OPTIONS}
          onValueChange={handleModeChange}
        />
        <CategoryPills
          mode={mode}
          selectedCategories={selectedCategories}
          onCategoriesChange={handleCategoriesChange}
        />
        <FilterSelects
          mode={mode}
          filters={filters}
          onFiltersChange={handleFiltersChange}
        />
      </SectionCard>

      {error && (
        <Alert variant="error">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertTitle>搜索失败</AlertTitle>
          <AlertDescription>
            {error.message} 请调整关键词或筛选条件后重试。
          </AlertDescription>
        </Alert>
      )}

      {data && !error && (
        <TorrentTable
          torrents={data.data}
          total={data.total}
          isLoading={isMutating}
          onSort={(field) => handleSortChange(field as RadarSortField)}
          getSortDirection={(field) =>
            getSortDirection(field as RadarSortField)
          }
        />
      )}

      {!data && !error && !isMutating && (
        <StateCard
          icon={Search}
          title="等待搜索"
          description="输入关键词后开始检索"
        />
      )}
    </PageScaffold>
  );
}

export default function RadarPage() {
  return (
    <Suspense
      fallback={
        <StateCard
          icon={Search}
          iconClassName="motion-safe:animate-pulse motion-reduce:opacity-70"
          title="加载中…"
        />
      }
    >
      <RadarPageContent />
    </Suspense>
  );
}
