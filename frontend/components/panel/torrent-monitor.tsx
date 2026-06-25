/**
 * TorrentMonitor - PANEL torrent monitor.
 */

import { useEffect, useMemo, useRef } from "react";
import { AlertCircle, Pause, Play, Radar, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { SegmentedControl } from "@/components/common/segmented-control";
import { SimplePagination } from "@/components/common/simple-pagination";
import { StateCard } from "@/components/common/state-card";
import { SectionCard } from "@/components/common/section-card";
import {
  StickyActionCell,
  StickyActionHead,
  TorrentNameCell,
  TorrentPeerBadges,
} from "@/components/common/torrent-table-parts";
import { TorrentProgressBlock } from "@/components/panel/torrent-progress-block";
import { useAutoAnimateList } from "@/hooks/use-auto-animate-list";
import { useIsMobile } from "@/hooks/use-media-query";
import { usePanelMonitorQuery } from "@/hooks/use-panel-monitor-query";
import { usePanelTorrentActions } from "@/hooks/use-panel-torrent-actions";
import { usePanelTorrents } from "@/hooks/use-panel-torrents";
import { useSortable } from "@/hooks/use-sortable";
import {
  getPanelTorrentKey,
  getStatusFromState,
  isPaused,
  isRadarTag,
  PANEL_MONITOR_PAGE_SIZE,
  panelStatusOptions,
  sortPanelTags,
  type PanelSortField,
  type PanelTorrent,
} from "@/lib/panel-torrents";
import { panelTorrentSortExtractors, sortData } from "@/lib/sort-utils";
import { UserStatusBadge } from "@/components/common/torrent-ui";

/**
 * Render a torrent's qB tags. The RADAR (雷达下载) tag is a user-requested
 * download, so it gets a Signal-accent badge with a radar icon and renders
 * first — making it visually obvious which tasks should not be casually
 * deleted alongside auto-seeding (声呐做种 / PILOT) torrents.
 */
function PanelTagBadges({
  tags,
  limit,
  badgeClassName,
}: {
  tags: string[] | null | undefined;
  limit: number;
  badgeClassName?: string;
}) {
  return (
    <>
      {sortPanelTags(tags || [])
        .slice(0, limit)
        .map((tag) => {
          const radar = isRadarTag(tag);
          return (
            <Badge
              key={tag}
              variant={radar ? "info" : "outline"}
              size="sm"
              className={badgeClassName}
            >
              {radar ? <Radar aria-hidden="true" /> : null}
              {tag}
            </Badge>
          );
        })}
    </>
  );
}

export function TorrentMonitor() {
  const { data: torrents, isLoading, error, mutate } = usePanelTorrents();
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const {
    statusFilter,
    setStatusFilter: handleStatusFilterChange,
    page,
    setPage,
  } = usePanelMonitorQuery();
  const {
    deleteTarget,
    isDeleting,
    processingHashes,
    requestDelete,
    closeDelete,
    confirmDelete,
    pause,
    resume,
  } = usePanelTorrentActions(torrents, mutate);
  const isMobile = useIsMobile();

  const { handleSort, getSortDirection, sortField, sortDirection } =
    useSortable<PanelSortField>({
      defaultField: "name",
      defaultDirection: "asc",
    });

  const filteredTorrents = useMemo(() => {
    return torrents?.filter((torrent) => {
      if (statusFilter === "all") return true;
      return getStatusFromState(torrent.status || "") === statusFilter;
    });
  }, [torrents, statusFilter]);

  const sortedTorrents = useMemo(() => {
    if (!filteredTorrents) return [];
    return sortData(
      filteredTorrents,
      sortField,
      sortDirection,
      panelTorrentSortExtractors
    ) as PanelTorrent[];
  }, [filteredTorrents, sortField, sortDirection]);

  const pageCount = Math.max(
    1,
    Math.ceil(sortedTorrents.length / PANEL_MONITOR_PAGE_SIZE)
  );
  const currentPage = Math.min(page, pageCount);
  const pagedTorrents = useMemo(() => {
    const start = (currentPage - 1) * PANEL_MONITOR_PAGE_SIZE;
    return sortedTorrents.slice(start, start + PANEL_MONITOR_PAGE_SIZE);
  }, [currentPage, sortedTorrents]);
  const hasPagedTorrents = pagedTorrents.length > 0;

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount, setPage]);

  useAutoAnimateList(
    [tableBodyRef, cardContainerRef],
    hasPagedTorrents,
    [isMobile],
  );

  const refreshWarning = error ? (
    <Alert variant="warning" className="mb-3">
      <AlertCircle className="size-4" aria-hidden="true" />
      <AlertTitle>种子列表刷新失败</AlertTitle>
      <AlertDescription>
        <span>{error.message}</span>{" "}
        <span>请稍后重试，或确认 qBittorrent Web UI 可访问。</span>
      </AlertDescription>
    </Alert>
  ) : null;

  if (error && (!torrents || torrents.length === 0)) {
    return (
      <StateCard
        icon={AlertCircle}
        title="种子列表加载失败"
        description={
          <>
            <span>{error.message}</span>
            <span className="block">
              请稍后重试，或确认 qBittorrent Web UI 可访问。
            </span>
          </>
        }
      />
    );
  }

  if (isLoading && (!torrents || torrents.length === 0)) {
    return (
      <StateCard
        icon={Play}
        iconClassName="motion-safe:animate-pulse"
        title="加载种子列表…"
        description="正在读取 qBittorrent 状态…"
      />
    );
  }

  if (!torrents || torrents.length === 0) {
    return (
      <StateCard
        icon={Pause}
        title="暂无活跃种子"
        description="当前没有下载或做种任务"
      />
    );
  }

  const deleteDialog = (
    <AlertDialog
      open={!!deleteTarget}
      onOpenChange={(open) => {
        if (!open) closeDelete();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除</AlertDialogTitle>
          <AlertDialogDescription>
            确定要删除种子 <strong className="break-words">{deleteTarget?.name}</strong>{" "}
            吗？此操作会删除种子及文件。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="outline" disabled={isDeleting} />}>
            取消
          </AlertDialogClose>
          <Button
            variant="destructive"
            onClick={confirmDelete}
            disabled={isDeleting}
            loading={isDeleting}
          >
            确认删除
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (isMobile) {
    return (
      <>
        <SectionCard
          title="种子监控"
          action={
            <SegmentedControl
              ariaLabel="种子状态筛选"
              value={statusFilter}
              options={panelStatusOptions}
              onValueChange={handleStatusFilterChange}
              className="pb-1"
            />
          }
          contentClassName="p-3"
        >
            {refreshWarning}
            <div ref={cardContainerRef} className="space-y-3">
              {pagedTorrents.map((torrent) => {
                const hash = getPanelTorrentKey(torrent);
                const torrentName = torrent.name || hash || "未知种子";
                const paused = isPaused(torrent.status);

                return (
                  <Card key={hash} className="p-3">
                    <div className="min-w-0 space-y-3">
                      <div>
                        <h3 className="line-clamp-2 text-sm font-medium leading-5">
                          {torrentName}
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <UserStatusBadge status={torrent.status || ""} />
                          <PanelTagBadges
                            tags={torrent.tags}
                            limit={2}
                            badgeClassName="max-w-full whitespace-normal break-words text-left"
                          />
                        </div>
                      </div>
                      <TorrentProgressBlock torrent={torrent} />
                      <div className="flex items-center justify-between gap-2">
                        <TorrentPeerBadges
                          seeders={torrent.seeders}
                          leechers={torrent.leechers}
                        />
                        <div className="flex gap-1">
                          <Button
                            size="icon-sm"
                            variant="outline"
                            onClick={() =>
                              paused
                                ? resume(hash, torrentName)
                                : pause(hash, torrentName)
                            }
                            disabled={processingHashes.has(hash)}
                            loading={processingHashes.has(hash)}
                            aria-label={paused ? `恢复种子：${torrentName}` : `暂停种子：${torrentName}`}
                          >
                            {paused ? (
                              <Play className="size-4" aria-hidden="true" />
                            ) : (
                              <Pause className="size-4" aria-hidden="true" />
                            )}
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="destructive-outline"
                            onClick={() => requestDelete(hash, torrentName)}
                            disabled={isDeleting}
                            aria-label={`删除种子：${torrentName}`}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
            {pageCount > 1 && (
              <div className="pt-3">
                <SimplePagination
                  page={currentPage}
                  pageCount={pageCount}
                  onPageChange={setPage}
                />
              </div>
            )}
        </SectionCard>
        {deleteDialog}
      </>
    );
  }

  return (
    <>
      <SectionCard
        title="种子监控"
        action={
          <SegmentedControl
            ariaLabel="种子状态筛选"
            value={statusFilter}
            options={panelStatusOptions}
            onValueChange={handleStatusFilterChange}
          />
        }
        contentClassName="p-0"
      >
          {refreshWarning && <div className="border-b p-3">{refreshWarning}</div>}
          <Table className="min-w-[940px]">
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  sortKey="name"
                  sortDirection={getSortDirection("name")}
                  onSort={(key) => handleSort(key as PanelSortField)}
                  className="min-w-[360px]"
                >
                  名称
                </SortableTableHead>
                <TableHead className="w-32">状态</TableHead>
                <TableHead className="w-36">做种/下载</TableHead>
                <SortableTableHead
                  sortKey="progress"
                  sortDirection={getSortDirection("progress")}
                  onSort={(key) => handleSort(key as PanelSortField)}
                  className="w-64"
                >
                  进度
                </SortableTableHead>
                <StickyActionHead className="w-28" align="right" />
              </TableRow>
            </TableHeader>
            <TableBody ref={tableBodyRef}>
              {pagedTorrents.map((torrent) => {
                const hash = getPanelTorrentKey(torrent);
                const torrentName = torrent.name || hash || "未知种子";
                const paused = isPaused(torrent.status);

                return (
                  <TableRow key={hash}>
                    <TableCell className="w-[360px] min-w-[360px] max-w-[56rem]">
                      <TorrentNameCell
                        name={torrentName}
                        badges={
                          <PanelTagBadges
                            tags={torrent.tags}
                            limit={4}
                            badgeClassName="max-w-48 truncate"
                          />
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <UserStatusBadge status={torrent.status || ""} />
                    </TableCell>
                    <TableCell>
                      <TorrentPeerBadges
                        seeders={torrent.seeders}
                        leechers={torrent.leechers}
                      />
                    </TableCell>
                    <TableCell>
                      <TorrentProgressBlock torrent={torrent} />
                    </TableCell>
                    <StickyActionCell align="right">
                        <Button
                          size="icon-sm"
                          variant="outline"
                          onClick={() =>
                            paused
                              ? resume(hash, torrentName)
                              : pause(hash, torrentName)
                          }
                          disabled={processingHashes.has(hash)}
                          loading={processingHashes.has(hash)}
                          aria-label={paused ? `恢复种子：${torrentName}` : `暂停种子：${torrentName}`}
                        >
                          {paused ? (
                            <Play className="size-4" aria-hidden="true" />
                          ) : (
                            <Pause className="size-4" aria-hidden="true" />
                          )}
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="destructive-outline"
                          onClick={() => requestDelete(hash, torrentName)}
                          disabled={isDeleting}
                          aria-label={`删除种子：${torrentName}`}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                    </StickyActionCell>
                  </TableRow>
                );
              })}
              {sortedTorrents.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-32 text-center text-sm text-muted-foreground"
                  >
                    当前筛选没有匹配的种子。切换到“全部”或选择其他状态查看任务。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {pageCount > 1 && (
            <div className="border-t p-3">
              <SimplePagination
                page={currentPage}
                pageCount={pageCount}
                onPageChange={setPage}
              />
            </div>
          )}
      </SectionCard>
      {deleteDialog}
    </>
  );
}
