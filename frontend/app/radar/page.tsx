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
import type { SearchMode, Torrent } from "@/lib/types";

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

  const handleSearch = async () => {
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
      sortField: "CREATED_DATE",
      sortDirection: "DESC",
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
        <div className="mx-auto max-w-[95%] space-y-6">
        {/* 标题 */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">RADAR</h1>
          <p className="text-muted-foreground">种子搜索引擎</p>
        </div>

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
          />
        )}

        {!data && !error && !isMutating && (
          <Card className="p-12 text-center">
            <div className="text-6xl mb-4">🔍</div>
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
