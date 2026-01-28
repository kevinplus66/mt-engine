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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, ExternalLink } from "lucide-react";
import { DISCOUNT_STYLES, PARENT_CATEGORY_NAMES, CHILD_TO_PARENT } from "@/lib/constants";
import { downloadSonarTorrent } from "@/lib/api";
import { toast } from "sonner";
import type { Torrent } from "@/lib/types";
import { useState, useRef, useEffect } from "react";
import { autoAnimate } from "@formkit/auto-animate";
import { useIsMobile, useIsTablet } from "@/hooks/use-media-query";
import { TorrentCard } from "@/components/common/torrent-card";
import { TorrentDetailSheet } from "@/components/common/torrent-detail-sheet";

interface TorrentListProps {
  torrents: Torrent[];
}

export function TorrentList({ torrents }: TorrentListProps) {
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
    const styleMap: Record<string, { bg: string; color: string; label: string }> = {
      FREE: { bg: "#22c55e", color: "#ffffff", label: "免费" },
      "_2X_FREE": { bg: "#3b82f6", color: "#ffffff", label: "2x免费" },
      "_2X": { bg: "#a855f7", color: "#ffffff", label: "2x" },
      PERCENT_50: { bg: "#f97316", color: "#ffffff", label: "50%" },
      PERCENT_70: { bg: "#eab308", color: "#000000", label: "70%" },
      PERCENT_30: { bg: "#ef4444", color: "#ffffff", label: "30%" },
      NORMAL: { bg: "#e5e7eb", color: "#000000", label: "普通" },
    };

    const style = styleMap[torrent.discount] || styleMap.NORMAL;

    return (
      <span
        style={{
          backgroundColor: style.bg,
          color: style.color,
          borderColor: "#000000",
        }}
        className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest border-2 w-fit whitespace-nowrap transition-all"
      >
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
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">名称</TableHead>
                <TableHead className="w-[80px]">大小</TableHead>
                <TableHead className="w-[100px]">做种/下载</TableHead>
                <TableHead className="w-[90px] text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody ref={tableBodyRef}>
              {torrents.map((torrent) => (
                <TableRow key={torrent.id}>
                  <TableCell>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <div className="font-medium line-clamp-2 flex-1">
                          {torrent.name}
                        </div>
                        {getDiscountBadge(torrent)}
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
                        disabled={
                          downloadingIds.has(torrent.id) ||
                          torrent.user_status === "seeding" ||
                          torrent.user_status === "leeching"
                        }
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
      <div className="overflow-x-auto md:overflow-x-visible">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">名称</TableHead>
              <TableHead className="w-[90px]">大小</TableHead>
              <TableHead className="w-[120px]">做种/下载</TableHead>
              <TableHead className="w-[70px]">分类</TableHead>
              <TableHead className="w-[70px]">优惠</TableHead>
              <TableHead className="w-[90px]">状态</TableHead>
              <TableHead className="w-[90px]">剩余时间</TableHead>
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
                <TableCell>{getDiscountBadge(torrent)}</TableCell>
                <TableCell>{getUserStatusBadge(torrent.user_status)}</TableCell>
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
