"use client";

import {
  Suspense,
  useState,
} from "react";
import { AlertCircle, RefreshCw, Waves } from "lucide-react";
import { toast } from "@/lib/toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageScaffold } from "@/components/common/page-scaffold";
import { SimplePagination } from "@/components/common/simple-pagination";
import { StateCard } from "@/components/common/state-card";
import { SonarFilterPanel } from "@/components/sonar/sonar-filter-panel";
import { TorrentList } from "@/components/sonar/torrent-list";
import { useSonarQueryState } from "@/hooks/use-sonar-query-state";
import { useSonarTorrentView } from "@/hooks/use-sonar-torrent-view";
import { useSonarTorrents } from "@/hooks/use-sonar-torrents";
import { refreshTorrents } from "@/lib/api";
import type { SonarSortField } from "@/lib/sonar-view";

function SonarPageContent() {
  const { data: torrents, isLoading, error, mutate } = useSonarTorrents();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const sonarQuery = useSonarQueryState();
  const {
    page,
    pageSize,
    density,
    searchValue,
    debouncedSearch,
    setSearchValue,
    statusFilter,
    sizeFilter,
    seederFilter,
    remainingFilter,
    modeFilter,
    updateParam,
    reset,
    setPageParam,
    setPageSizeParam,
    setDensityParam,
  } = sonarQuery;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshTorrents();
      await mutate();
      toast.success("刷新成功");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `${error.message}，请稍后重试。`
          : "刷新失败，请稍后重试。"
      );
      void mutate().catch(() => undefined);
    } finally {
      setIsRefreshing(false);
    }
  };

  const {
    sortedTorrents,
    pagedTorrents,
    pageCount,
    currentPage,
    handleSort,
    getSortDirection,
  } = useSonarTorrentView({
    torrents,
    statusFilter,
    search: debouncedSearch,
    sizeFilter,
    seederFilter,
    remainingFilter,
    modeFilter,
    page,
    pageSize,
  });

  return (
    <PageScaffold
      eyebrow="SONAR"
      title="免费种子监控"
      description="从真实缓存中筛选免费种子，按剩余时间和热度快速排序。"
      icon={Waves}
      actions={
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          loading={isRefreshing}
          variant="outline"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          手动刷新
        </Button>
      }
      meta={
        torrents && (
          <>
            <Badge variant="secondary">共 {torrents.length} 条</Badge>
            <Badge variant="outline">显示 {sortedTorrents.length} 条</Badge>
          </>
        )
      }
    >
      <SonarFilterPanel
        searchValue={searchValue}
        onSearchValueChange={setSearchValue}
        onReset={reset}
        statusFilter={statusFilter}
        sizeFilter={sizeFilter}
        seederFilter={seederFilter}
        remainingFilter={remainingFilter}
        modeFilter={modeFilter}
        density={density}
        pageSize={pageSize}
        onStatusChange={(val) => updateParam("status", val)}
        onSizeChange={(val) => updateParam("size", val)}
        onSeederChange={(val) => updateParam("seeders", val)}
        onRemainingChange={(val) => updateParam("remaining", val)}
        onModeChange={(val) => updateParam("mode", val)}
        onDensityChange={setDensityParam}
        onPageSizeChange={setPageSizeParam}
      />

      {error && (
        <Alert variant="error">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>
            {error.message} 请检查后端连接后重试，或点击「手动刷新」重新读取缓存。
          </AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <StateCard
          icon={RefreshCw}
          iconClassName="animate-spin"
          title="加载种子列表…"
          description="正在读取真实后端缓存…"
        />
      )}

      {!isLoading && !error && sortedTorrents.length > 0 && (
        <>
          <TorrentList
            torrents={pagedTorrents}
            totalCount={sortedTorrents.length}
            density={density}
            onSort={(field) => handleSort(field as SonarSortField)}
            getSortDirection={(field) =>
              getSortDirection(field as SonarSortField)
            }
          />
          <SimplePagination
            page={currentPage}
            pageCount={pageCount}
            onPageChange={setPageParam}
          />
        </>
      )}

      {!isLoading && !error && sortedTorrents.length === 0 && (
        <StateCard
          icon={Waves}
          title="暂无匹配种子"
          description="请重置或调整筛选条件后重试。"
        />
      )}
    </PageScaffold>
  );
}

export default function SonarPage() {
  return (
    <Suspense
      fallback={
        <StateCard
          icon={RefreshCw}
          iconClassName="animate-spin"
          title="加载中…"
        />
      }
    >
      <SonarPageContent />
    </Suspense>
  );
}
