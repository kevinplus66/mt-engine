"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { SearchBar } from "@/components/radar/search-bar";
import { ModeTabs } from "@/components/radar/mode-tabs";
import { CategoryPills } from "@/components/radar/category-pills";
import { FilterSelects } from "@/components/radar/filter-selects";
import { TorrentTable } from "@/components/radar/torrent-table";
import { PageTransition } from "@/components/common/page-transition";
import { useRadarSearch } from "@/hooks/use-radar-search";
import { useSortable } from "@/hooks/use-sortable";
import { RADAR_SORT_FIELD_MAP } from "@/lib/sort-utils";
import type { SearchMode, Torrent } from "@/lib/types";
import { Telescope } from "lucide-react";

type RadarSortField = "name" | "size" | "seeders" | "time";

export default function RadarPage() {
  const [keyword, setKeyword] = useState("");
  const [mode, setMode] = useState<SearchMode>("normal");
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [filters, setFilters] = useState({
    standards: [] as number[],
    videoCodecs: [] as number[],
    audioCodecs: [] as number[],
    sources: [] as number[],
    countries: [] as number[],
    discount: "",
  });

  const { trigger, data, isMutating, error } = useRadarSearch();

  // Sorting state
  const {
    sortField,
    sortDirection,
    handleSort,
    getSortDirection,
  } = useSortable<RadarSortField>({
    defaultField: "time",
    defaultDirection: "desc",
  });

  const handleSearch = async () => {
    // Map internal sort field to API field name
    const apiSortField = RADAR_SORT_FIELD_MAP[sortField] || "CREATED_DATE";
    const apiSortDirection = sortDirection.toUpperCase();

    await trigger({
      keyword,
      mode,
      categories: selectedCategories,
      standards: filters.standards,
      videoCodecs: filters.videoCodecs,
      audioCodecs: filters.audioCodecs,
      sources: filters.sources,
      countries: filters.countries,
      discount: filters.discount,
      sortField: apiSortField,
      sortDirection: apiSortDirection,
      pageNumber: 1,
      pageSize: 50,
    });
  };

  const handleReset = () => {
    setKeyword("");
    setMode("normal");
    setSelectedCategories([]);
    setFilters({
      standards: [],
      videoCodecs: [],
      audioCodecs: [],
      sources: [],
      countries: [],
      discount: "",
    });
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
        {/* 标题 */}
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <span>RADAR</span>
          <span className="text-base font-normal text-muted-foreground">· 种子搜索引擎</span>
        </h1>

        {/* 搜索和筛选卡片 */}
        <Card className="p-6 space-y-4">
          <SearchBar
            keyword={keyword}
            onKeywordChange={setKeyword}
            onSearch={handleSearch}
            onReset={handleReset}
            isLoading={isMutating}
          />

          <ModeTabs mode={mode} onModeChange={setMode} />

          <CategoryPills
            mode={mode}
            selectedCategories={selectedCategories}
            onCategoriesChange={setSelectedCategories}
          />

          <FilterSelects
            mode={mode}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </Card>

        {/* 结果区域 */}
        {error && (
          <Card className="p-6 text-center text-red-600">
            搜索失败：{error.message}
          </Card>
        )}

        {data && (
          <TorrentTable
            torrents={data.data}
            total={data.total}
            isLoading={isMutating}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={(field) => {
              handleSort(field as RadarSortField);
              // Re-trigger search with new sort
              setTimeout(handleSearch, 0);
            }}
            getSortDirection={(field) => getSortDirection(field as RadarSortField)}
          />
        )}

        {!data && !error && !isMutating && (
          <Card className="p-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-6 bg-gray-100 dark:bg-zinc-900 rounded-full border-4 border-gray-200 dark:border-zinc-800">
                <Telescope className="h-16 w-16 text-gray-400 dark:text-gray-500" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-2">开始搜索</h3>
            <p className="text-muted-foreground">
              输入关键词并点击搜索按钮
            </p>
          </Card>
        )}
        </div>
      </div>
    </PageTransition>
  );
}
