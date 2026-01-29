/**
 * TorrentList - SONAR 种子列表组件
 * 显示免费种子，重点展示优惠倒计时和用户状态
 * 响应式：移动端卡片、平板精简表格、桌面完整表格
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, ExternalLink } from "lucide-react";
import { DISCOUNT_STYLES, PARENT_CATEGORY_NAMES, CHILD_TO_PARENT } from "@/lib/constants";
import { downloadSonarTorrent } from "@/lib/api";
import { toast } from "sonner";
import type { Torrent } from "@/lib/types";
import type { SortDirection } from "@/hooks/use-sortable";
import { useState, useRef, useEffect } from "react";
import { autoAnimate } from "@formkit/auto-animate";
import { useIsMobile, useIsTablet } from "@/hooks/use-media-query";
import { TorrentCard } from "@/components/common/torrent-card";
import { TorrentDetailSheet } from "@/components/common/torrent-detail-sheet";
import { NumberTicker } from "@/components/common/number-ticker";

interface TorrentListProps {
  torrents: Torrent[];
  onSort?: (field: string) => void;
  getSortDirection?: (field: string) => SortDirection | null;
}

export function TorrentList({
  torrents,
  onSort = () => {},
  getSortDirection = () => null,
}: TorrentListProps) {
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [selectedTorrent, setSelectedTorrent] = useState<Torrent | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);

  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  // AutoAnimate for table body and card container
  useEffect(() => {
    if (tableBodyRef.current) {
      autoAnimate(tableBodyRef.current);
    }
    if (cardContainerRef.current) {
      autoAnimate(cardContainerRef.current);
    }
  }, []);

  const handleDownload = async (torrentId: string) => {
    if (downloadingIds.has(torrentId)) return;

    setDownloadingIds(new Set(downloadingIds).add(torrentId));
    try {
      await downloadSonarTorrent({ id: torrentId });
      toast.success("种子已添加到下载队列");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "下载失败");
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(torrentId);
        return next;
      });
    }
  };

  const handleCardTap = (torrent: Torrent) => {
    setSelectedTorrent(torrent);
    setDetailSheetOpen(true);
  };

  const handleSheetDownload = async (torrentId: string) => {
    await handleDownload(torrentId);
    setDetailSheetOpen(false);
  };

  const getDiscountBadge = (torrent: Torrent) => {
    const styleMap: Record<string, { color: string; label: string }> = {
      FREE: { color: "text-green-600 dark:text-green-400", label: "免费" },
      "_2X_FREE": { color: "text-blue-600 dark:text-blue-400", label: "2X免费" },
      "_2X": { color: "text-purple-600 dark:text-purple-400", label: "2X" },
      PERCENT_50: { color: "text-orange-600 dark:text-orange-400", label: "50%" },
      PERCENT_70: { color: "text-yellow-600 dark:text-yellow-400", label: "70%" },
      PERCENT_30: { color: "text-red-600 dark:text-red-400", label: "30%" },
      NORMAL: { color: "text-gray-600 dark:text-gray-400", label: "普通" },
    };

    const style = styleMap[torrent.discount] || styleMap.NORMAL;

    return (
      <span className={`inline-flex items-center justify-center px-1.5 py-0 h-5 text-[10px] font-mono font-bold uppercase tracking-widest border-2 border-black dark:border-white bg-white dark:bg-zinc-900 ${style.color} w-fit whitespace-nowrap transition-all`}>
        {style.label}
      </span>
    );
  };

  const getUserStatusBadge = (status: string) => {
    switch (status) {
      case "seeding":
        return (
          <Badge variant="outline" className="text-green-600 border-green-600">
            做种中
          </Badge>
        );
      case "leeching":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            下载中
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-gray-600">
            未下载
          </Badge>
        );
    }
  };

  const getCategoryName = (categoryId: number) => {
    // First try to get parent category directly
    if (PARENT_CATEGORY_NAMES[categoryId]) {
      return PARENT_CATEGORY_NAMES[categoryId];
    }
    // If not found, try to map child to parent
    const parentId = CHILD_TO_PARENT[categoryId];
    if (parentId && PARENT_CATEGORY_NAMES[parentId]) {
      return PARENT_CATEGORY_NAMES[parentId];
    }
    return "未知";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString("zh-CN");
  };

  if (torrents.length === 0) {
    return null;
  }

  // Mobile View: Cards
  if (isMobile) {
    return (
      <>
        <div ref={cardContainerRef} className="space-y-3">
          {torrents.map((torrent) => (
            <TorrentCard
              key={torrent.id}
              torrent={torrent}
              onTap={handleCardTap}
              showRemaining={true}
            />
          ))}
        </div>
        <TorrentDetailSheet
          torrent={selectedTorrent}
          open={detailSheetOpen}
          onOpenChange={setDetailSheetOpen}
          onDownload={handleSheetDownload}
          isDownloading={selectedTorrent ? downloadingIds.has(selectedTorrent.id) : false}
        />
      </>
    );
  }

  // Tablet View: Condensed Table
  if (isTablet) {
    return (
      <Card>
        <div className="overflow-x-auto relative">
          <Table className="w-full min-w-[600px]">
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  sortKey="name"
                  sortDirection={getSortDirection("name")}
                  onSort={onSort}
                  className="w-auto min-w-[300px]"
                >
                  名称
                </SortableTableHead>
                <SortableTableHead
                  sortKey="size"
                  sortDirection={getSortDirection("size")}
                  onSort={onSort}
                  className="w-[120px] min-w-[120px] max-w-[120px] sticky right-[210px] bg-black dark:bg-white z-20 shadow-[-1px_0_0_0_rgba(255,255,255,0.1)] dark:shadow-[-1px_0_0_0_rgba(0,0,0,0.1)]"
                >
                  大小
                </SortableTableHead>
                <SortableTableHead
                  sortKey="seeders"
                  sortDirection={getSortDirection("seeders")}
                  onSort={onSort}
                  className="w-[120px] min-w-[120px] max-w-[120px] sticky right-[90px] bg-black dark:bg-white z-20"
                >
                  做种/下载
                </SortableTableHead>
                <TableHead className="w-[90px] min-w-[90px] max-w-[90px] text-center sticky right-0 bg-black dark:bg-white z-20">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody ref={tableBodyRef}>
              {torrents.map((torrent) => (
                <TableRow key={torrent.id}>
                  <TableCell className="min-w-[300px]">
                    <div className="space-y-1">
                      <div className="font-medium whitespace-nowrap">
                        {torrent.name}
                      </div>
                      <div className="flex items-center gap-1 w-max">
                        <Badge variant="secondary" className="text-[10px] px-1.5 h-5 flex items-center justify-center border-2 border-black dark:border-white whitespace-nowrap">
                           {getCategoryName(torrent.category)}
                        </Badge>
                        {getDiscountBadge(torrent)}
                        {torrent.quality_metadata?.labels_new && torrent.quality_metadata.labels_new.length > 0 && (
                          torrent.quality_metadata.labels_new.map((label, idx) => (
                            <Badge key={idx} variant="outline" className="text-[10px] px-1.5 h-5 flex items-center justify-center border-2 border-black dark:border-white bg-white dark:bg-zinc-900 text-black dark:text-white whitespace-nowrap">
                              {label}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap sticky right-[210px] w-[120px] min-w-[120px] max-w-[120px] bg-white dark:bg-zinc-950 z-10 shadow-[-1px_0_0_0_rgba(0,0,0,0.1)] dark:shadow-[-1px_0_0_0_rgba(255,255,255,0.1)]">
                    {torrent.size_display}
                  </TableCell>
                  <TableCell className="sticky right-[90px] w-[120px] min-w-[120px] max-w-[120px] bg-white dark:bg-zinc-950 z-10">
                    <div className="flex gap-1">
                      <Badge variant="outline" className="text-[10px] px-1.5 h-5 flex items-center justify-center border-2 text-green-600 border-green-600 whitespace-nowrap">
                        ↑ <NumberTicker value={torrent.seeders} />
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 h-5 flex items-center justify-center border-2 text-blue-600 border-blue-600 whitespace-nowrap">
                        ↓ <NumberTicker value={torrent.leechers} />
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-center sticky right-0 w-[90px] min-w-[90px] max-w-[90px] bg-white dark:bg-zinc-950 z-10">
                    <div className="flex gap-1 justify-center">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleDownload(torrent.id)}
                        disabled={
                          downloadingIds.has(torrent.id) ||
                          torrent.user_status === "seeding" ||
                          torrent.user_status === "leeching"
                        }
                        aria-label="下载种子"
                        className="h-9 w-9 p-0"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" asChild className="h-9 w-9 p-0">
                        <a
                          href={torrent.detail_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="查看详情"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    );
  }

  // Desktop View: Full Table
  return (
    <Card>
      <div className="overflow-x-auto md:overflow-x-visible">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow>
              <SortableTableHead
                sortKey="name"
                sortDirection={getSortDirection("name")}
                onSort={onSort}
                className="min-w-[200px]"
              >
                名称
              </SortableTableHead>
              <SortableTableHead
                sortKey="size"
                sortDirection={getSortDirection("size")}
                onSort={onSort}
                className="w-[120px]"
              >
                大小
              </SortableTableHead>
              <SortableTableHead
                sortKey="seeders"
                sortDirection={getSortDirection("seeders")}
                onSort={onSort}
                className="w-[120px]"
              >
                做种/下载
              </SortableTableHead>
              <TableHead className="w-[90px]">分类</TableHead>
              <TableHead className="w-[100px]">状态</TableHead>
              <SortableTableHead
                sortKey="remaining"
                sortDirection={getSortDirection("remaining")}
                onSort={onSort}
                className="w-[100px]"
              >
                剩余时间
              </SortableTableHead>
              <TableHead className="w-[100px] text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody ref={tableBodyRef}>
            {torrents.map((torrent) => (
              <TableRow key={torrent.id}>
                <TableCell>
                  <div className="space-y-1 min-w-0">
                    <div className="font-medium line-clamp-2">
                      {torrent.name}
                    </div>
                    {torrent.small_descr && (
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {torrent.small_descr}
                      </div>
                    )}
                    {/* Discount badge and Labels on same row */}
                    <div className="flex flex-wrap gap-1 items-center">
                      {getDiscountBadge(torrent)}
                      {torrent.quality_metadata?.labels_new && torrent.quality_metadata.labels_new.length > 0 && (
                        torrent.quality_metadata.labels_new.map((label, idx) => (
                          <Badge key={idx} variant="outline" className="text-[10px] px-1.5 h-5 flex items-center justify-center border-2 border-black dark:border-white bg-white dark:bg-zinc-900 text-black dark:text-white whitespace-nowrap">
                            {label}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {torrent.size_display}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-green-600 h-5 border-2 text-[10px] px-1.5 flex items-center justify-center border-green-600">
                      ↑ <NumberTicker value={torrent.seeders} />
                    </Badge>
                    <Badge variant="outline" className="text-blue-600 h-5 border-2 text-[10px] px-1.5 flex items-center justify-center border-blue-600">
                      ↓ <NumberTicker value={torrent.leechers} />
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="h-5 border-2 border-black dark:border-white text-[10px] px-1.5 flex items-center justify-center">
                    {getCategoryName(torrent.category)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {(() => {
                    const status = torrent.user_status;
                    if (status === "seeding") {
                      return <Badge variant="outline" className="text-green-600 border-green-600 h-5 border-2 text-[10px] px-1.5 flex items-center justify-center">做种中</Badge>;
                    } else if (status === "leeching") {
                      return <Badge variant="outline" className="text-blue-600 border-blue-600 h-5 border-2 text-[10px] px-1.5 flex items-center justify-center">下载中</Badge>;
                    } else {
                      return <Badge variant="outline" className="text-gray-600 h-5 border-2 text-[10px] px-1.5 flex items-center justify-center">未下载</Badge>;
                    }
                  })()}
                </TableCell>
                <TableCell
                  className={`text-sm whitespace-nowrap font-medium ${
                    torrent.remaining && torrent.remaining.hours < 0.5
                      ? "text-red-600"
                      : "text-muted-foreground"
                  }`}
                >
                  {torrent.remaining ? torrent.remaining.display : "-"}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex gap-1 justify-center">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleDownload(torrent.id)}
                      disabled={
                        downloadingIds.has(torrent.id) ||
                        torrent.user_status === "seeding" ||
                        torrent.user_status === "leeching"
                      }
                      aria-label="下载种子"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href={torrent.detail_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="查看详情"
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </a>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
