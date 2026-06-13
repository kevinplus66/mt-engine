/**
 * TorrentTable - RADAR search results.
 */

import { useEffect, useRef } from "react";
import { Compass } from "lucide-react";
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
import { StateCard } from "@/components/common/state-card";
import {
  StickyActionCell,
  StickyActionHead,
  TorrentDownloadActions,
  TorrentNameCell,
  TorrentPeerBadges,
} from "@/components/common/torrent-table-parts";
import { TorrentCard } from "@/components/common/torrent-card";
import { TorrentDetailSheet } from "@/components/common/torrent-detail-sheet";
import {
  DiscountBadge,
  formatRelativeDate,
  getCategoryName,
  QualityBadges,
} from "@/components/common/torrent-ui";
import { useAutoAnimateList } from "@/hooks/use-auto-animate-list";
import { useDeferredSheetState } from "@/hooks/use-deferred-sheet-state";
import { useIsMobile } from "@/hooks/use-media-query";
import type { SortDirection } from "@/hooks/use-sortable";
import { useTorrentDownload } from "@/hooks/use-torrent-download";
import { downloadTorrent as downloadTorrentApi } from "@/lib/api";
import type { Torrent } from "@/lib/types";

interface TorrentTableProps {
  torrents: Torrent[];
  total: number;
  isLoading?: boolean;
  onSort?: (field: string) => void;
  getSortDirection?: (field: string) => SortDirection | null;
}

export function TorrentTable({
  torrents,
  total,
  isLoading = false,
  onSort = () => {},
  getSortDirection = () => null,
}: TorrentTableProps) {
  const {
    item: selectedTorrent,
    open: detailSheetOpen,
    openWithItem: openDetails,
    setOpen: setDetailSheetOpen,
    reset: resetDetailSheet,
    handleOpenChangeComplete,
  } = useDeferredSheetState<Torrent>();
  const { downloadingIds, downloadTorrent } = useTorrentDownload((torrentId) =>
    downloadTorrentApi({ id: torrentId })
  );
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const hasTorrents = torrents.length > 0;

  useAutoAnimateList([tableBodyRef, cardContainerRef], hasTorrents, [isMobile]);

  useEffect(() => {
    if (!selectedTorrent) return;

    for (const torrent of torrents) {
      if (torrent.id === selectedTorrent.id) return;
    }

    resetDetailSheet();
  }, [resetDetailSheet, selectedTorrent, torrents]);


  const handleSheetDownload = async (torrentId: string) => {
    await downloadTorrent(torrentId);
    setDetailSheetOpen(false);
  };

  if (torrents.length === 0) {
    return (
      <StateCard
        icon={Compass}
        title="没有找到结果"
        description="换一个关键词或放宽筛选条件"
      />
    );
  }

  if (isMobile) {
    return (
      <>
        <div className="flex items-center justify-between text-muted-foreground text-sm">
          <span className="tabular-nums">
            显示 <strong>{torrents.length}</strong> / <strong>{total}</strong>
          </span>
          {isLoading && (
            <Badge variant="secondary" aria-live="polite">
              更新中…
            </Badge>
          )}
        </div>
        <div ref={cardContainerRef} className="space-y-3">
          {torrents.map((torrent) => (
            <TorrentCard
              key={torrent.id}
              torrent={torrent}
              onTap={openDetails}
              hideDiscount
              showUploadTime
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

  return (
    <SectionCard
      title="搜索结果"
      action={
        <div className="flex items-center gap-2 text-muted-foreground text-sm font-normal">
          <span className="tabular-nums">{torrents.length} / {total}</span>
          {isLoading && (
            <Badge variant="secondary" aria-live="polite">
              更新中…
            </Badge>
          )}
        </div>
      }
      contentClassName="p-0"
    >
        <Table className="min-w-[980px]">
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
              <SortableTableHead
                sortKey="time"
                sortDirection={getSortDirection("time")}
                onSort={onSort}
                className="w-28"
              >
                时间
              </SortableTableHead>
              <StickyActionHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody ref={tableBodyRef}>
            {torrents.map((torrent) => (
              <TableRow key={torrent.id}>
                <TableCell className="w-[360px] min-w-0 max-w-[56rem]">
                  <TorrentNameCell
                    name={torrent.name}
                    description={torrent.small_descr}
                    onOpen={() => openDetails(torrent)}
                    badges={
                      <>
                        <DiscountBadge discount={torrent.discount} />
                        <QualityBadges torrent={torrent} />
                      </>
                    }
                  />
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
                  />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatRelativeDate(torrent.created_date)}
                </TableCell>
                <StickyActionCell>
                  <TorrentDownloadActions
                    detailUrl={torrent.detail_url}
                    onDownload={() => downloadTorrent(torrent.id)}
                    isDownloading={downloadingIds.has(torrent.id)}
                  />
                </StickyActionCell>
              </TableRow>
            ))}
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
