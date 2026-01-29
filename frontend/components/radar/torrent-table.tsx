/**
 * TorrentTable - 种子结果表格
 * 显示搜索结果，包括名称、大小、做种/下载、分类、时间等
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, ExternalLink } from "lucide-react";
import { DISCOUNT_STYLES, PARENT_CATEGORY_NAMES, CHILD_TO_PARENT } from "@/lib/constants";
import { downloadTorrent } from "@/lib/api";
import { toast } from "sonner";
import type { Torrent } from "@/lib/types";
import { useState, useRef, useEffect } from "react";
import { autoAnimate } from "@formkit/auto-animate";
import { useIsMobile, useIsTablet } from "@/hooks/use-media-query";
import { TorrentCard } from "@/components/common/torrent-card";
import { TorrentDetailSheet } from "@/components/common/torrent-detail-sheet";

interface TorrentTableProps {
  torrents: Torrent[];
  total: number;
  isLoading?: boolean;
}

export function TorrentTable({
  torrents,
  total,
  isLoading = false,
}: TorrentTableProps) {
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
      await downloadTorrent({ id: torrentId });
      toast.success("种子已添加到下载队列");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "下载失败"
      );
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
      <span className={`inline-flex items-center justify-center px-1.5 py-0 text-[10px] font-mono font-bold uppercase tracking-widest border-2 border-black dark:border-white bg-white dark:bg-zinc-900 ${style.color} w-fit whitespace-nowrap transition-all`}>
        {style.label}
      </span>
    );
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
    return (
      <Card className="p-12 text-center">
        <div className="text-6xl mb-4">📭</div>
        <h3 className="text-xl font-semibold mb-2">没有找到结果</h3>
        <p className="text-muted-foreground">
          请尝试其他关键词或调整筛选条件
        </p>
      </Card>
    );
  }

  // Mobile View: Cards
  if (isMobile) {
    return (
      <>
        <Card className="p-4 border-b-2 border-black dark:border-white mb-3">
          <div className="text-sm text-muted-foreground">
            显示 <strong>{torrents.length}</strong> / <strong>{total}</strong> 个结果
          </div>
        </Card>
        <div ref={cardContainerRef} className="space-y-3">
          {torrents.map((torrent) => (
            <TorrentCard
              key={torrent.id}
              torrent={torrent}
              onTap={handleCardTap}
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
        <div className="p-4 border-b">
          <div className="text-sm text-muted-foreground">
            显示 <strong>{torrents.length}</strong> / <strong>{total}</strong> 个结果
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[35%]">名称</TableHead>
                <TableHead className="w-[15%]">大小</TableHead>
                <TableHead className="w-[28%]">做种/下载</TableHead>
                <TableHead className="w-[22%] text-center">操作</TableHead>
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
                      <div className="flex flex-wrap gap-1 items-center">
                        {getDiscountBadge(torrent)}
                        {torrent.quality_metadata?.labels_new && torrent.quality_metadata.labels_new.length > 0 && (
                          torrent.quality_metadata.labels_new.map((label, idx) => (
                            <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 text-black dark:text-white">
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
                      <Badge variant="outline" className="text-green-600">
                        ↑ {torrent.seeders}
                      </Badge>
                      <Badge variant="outline" className="text-blue-600">
                        ↓ {torrent.leechers}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex gap-1 justify-center">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleDownload(torrent.id)}
                        disabled={downloadingIds.has(torrent.id)}
                        aria-label="下载种子"
                        className="h-9"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" asChild className="h-9">
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
      <div className="p-4 border-b">
        <div className="text-sm text-muted-foreground">
          显示 <strong>{torrents.length}</strong> / <strong>{total}</strong> 个结果
        </div>
      </div>

      <div className="overflow-x-auto md:overflow-x-visible">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">名称</TableHead>
              <TableHead className="w-[90px]">大小</TableHead>
              <TableHead className="w-[120px]">做种/下载</TableHead>
              <TableHead className="w-[70px]">分类</TableHead>
              <TableHead className="w-[100px]">时间</TableHead>
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
                          <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 text-black dark:text-white">
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
                    <Badge variant="outline" className="text-green-600">
                      ↑ {torrent.seeders}
                    </Badge>
                    <Badge variant="outline" className="text-blue-600">
                      ↓ {torrent.leechers}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {getCategoryName(torrent.category)}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {formatDate(torrent.created_date)}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex gap-1 justify-center">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleDownload(torrent.id)}
                      disabled={downloadingIds.has(torrent.id)}
                      aria-label="下载种子"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" asChild>
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
