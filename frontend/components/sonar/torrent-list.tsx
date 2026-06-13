/**
 * TorrentList - SONAR free torrent list.
 */

import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { SectionCard } from "@/components/common/section-card";
import {
  StickyActionCell,
  StickyActionHead,
  TorrentDownloadActions,
  TorrentPeerBadges,
} from "@/components/common/torrent-table-parts";
import { TorrentCard } from "@/components/common/torrent-card";
import { TorrentDetailSheet } from "@/components/common/torrent-detail-sheet";
import {
  DiscountBadge,
  getCategoryName,
  QualityBadges,
  UserStatusBadge,
} from "@/components/common/torrent-ui";
import { useAutoAnimateList } from "@/hooks/use-auto-animate-list";
import { useDeferredSheetState } from "@/hooks/use-deferred-sheet-state";
import { useIsMobile } from "@/hooks/use-media-query";
import type { SortDirection } from "@/hooks/use-sortable";
import { useTorrentDownload } from "@/hooks/use-torrent-download";
import { downloadSonarTorrent as downloadSonarTorrentApi } from "@/lib/api";
import type { Torrent } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TorrentListProps {
  torrents: Torrent[];
  density?: "compact" | "comfortable";
  totalCount?: number;
  onSort?: (field: string) => void;
  getSortDirection?: (field: string) => SortDirection | null;
}

const SONAR_MAX_RENDERED_TORRENTS = 50;

export function TorrentList({
  torrents,
  density = "compact",
  totalCount,
  onSort = () => {},
  getSortDirection = () => null,
}: TorrentListProps) {
  const {
    item: selectedTorrent,
    open: detailSheetOpen,
    openWithItem: openDetails,
    setOpen: setDetailSheetOpen,
    reset: resetDetailSheet,
    handleOpenChangeComplete,
  } = useDeferredSheetState<Torrent>();
  const { downloadingIds, downloadTorrent } = useTorrentDownload((torrentId) =>
    downloadSonarTorrentApi({ id: torrentId })
  );
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const visibleTorrents = torrents.slice(0, SONAR_MAX_RENDERED_TORRENTS);
  const hasVisibleTorrents = visibleTorrents.length > 0;

  useAutoAnimateList(
    [tableBodyRef, cardContainerRef],
    hasVisibleTorrents,
    [isMobile],
  );

  useEffect(() => {
    if (!selectedTorrent) return;

    const renderedTorrentCount = Math.min(
      torrents.length,
      SONAR_MAX_RENDERED_TORRENTS,
    );
    for (let index = 0; index < renderedTorrentCount; index += 1) {
      if (torrents[index]?.id === selectedTorrent.id) return;
    }

    resetDetailSheet();
  }, [resetDetailSheet, selectedTorrent, torrents]);


  const handleSheetDownload = async (torrentId: string) => {
    await downloadTorrent(torrentId);
    setDetailSheetOpen(false);
  };

  if (!hasVisibleTorrents) return null;

  if (isMobile) {
    return (
      <>
        <div ref={cardContainerRef} className="space-y-3">
          {visibleTorrents.map((torrent) => (
            <TorrentCard
              key={torrent.id}
              torrent={torrent}
              onTap={openDetails}
              showRemaining
            />
          ))}
        </div>
        <TorrentDetailSheet
          torrent={selectedTorrent}
          open={detailSheetOpen}
          onOpenChange={setDetailSheetOpen}
          onOpenChangeComplete={handleOpenChangeComplete}
          onDownload={handleSheetDownload}
          isDownloading={
            selectedTorrent ? downloadingIds.has(selectedTorrent.id) : false
          }
        />
      </>
    );
  }

  const compact = density === "compact";

  return (
    <SectionCard
      title="免费种子"
      action={
        typeof totalCount === "number" ? (
          <span className="text-muted-foreground text-sm font-normal tabular-nums">
            {visibleTorrents.length} / {totalCount}
          </span>
        ) : undefined
      }
      contentClassName="p-0"
    >
        <Table className="min-w-[1040px]">
          <TableHeader>
            <TableRow>
              <SortableTableHead
                sortKey="name"
                sortDirection={getSortDirection("name")}
                onSort={onSort}
                className="min-w-[360px]"
              >
                名称
              </SortableTableHead>
              <SortableTableHead
                sortKey="size"
                sortDirection={getSortDirection("size")}
                onSort={onSort}
                className="w-28"
              >
                大小
              </SortableTableHead>
              <TableHead className="w-24">分类</TableHead>
              <SortableTableHead
                sortKey="seeders"
                sortDirection={getSortDirection("seeders")}
                onSort={onSort}
                className="w-32"
              >
                做种/下载
              </SortableTableHead>
              <TableHead className="w-24">状态</TableHead>
              <SortableTableHead
                sortKey="remaining"
                sortDirection={getSortDirection("remaining")}
                onSort={onSort}
                className="w-28"
              >
                剩余
              </SortableTableHead>
              <StickyActionHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody ref={tableBodyRef}>
            {visibleTorrents.map((torrent) => {
              const canDownload =
                torrent.user_status !== "seeding" &&
                torrent.user_status !== "leeching";

              return (
                <TableRow key={torrent.id}>
                  <TableCell
                    className={
                      compact
                        ? "w-[360px] min-w-[360px] max-w-[56rem] overflow-hidden py-2"
                        : "w-[360px] min-w-[360px] max-w-[56rem] overflow-hidden py-3.5"
                    }
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="max-w-[56rem] min-w-0 pr-2 font-medium leading-5">
                        <button
                          type="button"
                          onClick={() => openDetails(torrent)}
                          aria-label={`查看种子详情：${torrent.name}`}
                          className={cn(
                            "w-full cursor-pointer rounded-sm text-left outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                            compact
                              ? "block truncate"
                              : "line-clamp-2 whitespace-normal break-words"
                          )}
                          title={torrent.name}
                        >
                          {torrent.name}
                        </button>
                      </div>
                      {!compact && torrent.small_descr && (
                        <div className="max-w-[56rem] truncate text-muted-foreground text-xs">
                          {torrent.small_descr}
                        </div>
                      )}
                      <div className="flex max-w-[56rem] flex-wrap gap-1">
                        <DiscountBadge discount={torrent.discount} />
                        <QualityBadges torrent={torrent} />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {torrent.size_display}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" size="sm">
                      {getCategoryName(torrent.category)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <TorrentPeerBadges
                      seeders={torrent.seeders}
                      leechers={torrent.leechers}
                      animated
                    />
                  </TableCell>
                  <TableCell>
                    <UserStatusBadge status={torrent.user_status} />
                  </TableCell>
                  <TableCell>
                    {torrent.remaining ? (
                      <Badge
                        variant={
                          torrent.remaining.hours < 1 ? "error" : "warning"
                        }
                        size="sm"
                      >
                        {torrent.remaining.display}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <StickyActionCell>
                    <TorrentDownloadActions
                      detailUrl={torrent.detail_url}
                      onDownload={() => downloadTorrent(torrent.id)}
                      isDownloading={downloadingIds.has(torrent.id)}
                      canDownload={canDownload}
                    />
                  </StickyActionCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      <TorrentDetailSheet
        torrent={selectedTorrent}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onOpenChangeComplete={handleOpenChangeComplete}
        onDownload={handleSheetDownload}
        isDownloading={
          selectedTorrent ? downloadingIds.has(selectedTorrent.id) : false
        }
      />
    </SectionCard>
  );
}
