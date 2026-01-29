/**
 * TorrentDetailSheet - Mobile bottom sheet for displaying full torrent details
 * Shows when user taps a torrent card on mobile
 */

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Download, ExternalLink } from "lucide-react";
import type { Torrent } from "@/lib/types";
import { PARENT_CATEGORY_NAMES, CHILD_TO_PARENT } from "@/lib/constants";

interface TorrentDetailSheetProps {
  torrent: Torrent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload: (torrentId: string) => void;
  isDownloading: boolean;
}

export function TorrentDetailSheet({
  torrent,
  open,
  onOpenChange,
  onDownload,
  isDownloading,
}: TorrentDetailSheetProps) {
  if (!torrent) return null;

  const getDiscountBadge = (discount: string) => {
    const styleMap: Record<string, { color: string; label: string }> = {
      FREE: { color: "text-green-600 dark:text-green-400", label: "免费" },
      "_2X_FREE": { color: "text-blue-600 dark:text-blue-400", label: "2X免费" },
      "_2X": { color: "text-purple-600 dark:text-purple-400", label: "2X" },
      PERCENT_50: { color: "text-orange-600 dark:text-orange-400", label: "50%" },
      PERCENT_70: { color: "text-yellow-600 dark:text-yellow-400", label: "70%" },
      PERCENT_30: { color: "text-red-600 dark:text-red-400", label: "30%" },
      NORMAL: { color: "text-gray-600 dark:text-gray-400", label: "普通" },
    };

    const style = styleMap[discount] || styleMap.NORMAL;

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
          <Badge variant="outline" className="text-green-600 border-green-600 h-5 border-2 text-[10px] px-1.5 flex items-center justify-center">
            做种中
          </Badge>
        );
      case "leeching":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-600 h-5 border-2 text-[10px] px-1.5 flex items-center justify-center">
            下载中
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-gray-600 h-5 border-2 text-[10px] px-1.5 flex items-center justify-center">
            未下载
          </Badge>
        );
    }
  };

  const getCategoryName = (categoryId: number) => {
    if (PARENT_CATEGORY_NAMES[categoryId]) {
      return PARENT_CATEGORY_NAMES[categoryId];
    }
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

  const canDownload = torrent.user_status !== "seeding" && torrent.user_status !== "leeching" && !isDownloading;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-lg p-0">
        <SheetHeader className="p-4 pb-3 border-b-2 border-black dark:border-white">
          <SheetTitle className="text-left text-base font-bold leading-snug pr-8">
            {torrent.name}
          </SheetTitle>
        </SheetHeader>

        <div className="overflow-y-auto p-4 pb-20 space-y-4">
          {/* Small Description */}
          {torrent.small_descr && (
            <div className="text-sm text-muted-foreground">
              {torrent.small_descr}
            </div>
          )}

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-y-6 gap-x-4">
            {/* Category */}
            <div className="flex flex-col gap-2">
              <div className="text-xs text-muted-foreground">分类</div>
              <Badge variant="secondary" className="h-5 border-2 border-black dark:border-white text-[10px] px-1.5 flex items-center justify-center w-fit">
                {getCategoryName(torrent.category)}
              </Badge>
            </div>

            {/* Discount */}
            <div className="flex flex-col gap-2">
              <div className="text-xs text-muted-foreground">优惠</div>
              {getDiscountBadge(torrent.discount)}
            </div>

            {/* Size */}
            <div className="flex flex-col gap-2">
              <div className="text-xs text-muted-foreground">大小</div>
              <div className="font-mono font-medium h-5 flex items-center">{torrent.size_display}</div>
            </div>

            {/* Status */}
            <div className="flex flex-col gap-2">
              <div className="text-xs text-muted-foreground">状态</div>
              {getUserStatusBadge(torrent.user_status)}
            </div>

            {/* Seeders/Leechers */}
            <div className="flex flex-col gap-2">
              <div className="text-xs text-muted-foreground">做种/下载</div>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-green-600 border-green-600 h-5 border-2 text-[10px] px-1.5 flex items-center justify-center">
                  ↑ {torrent.seeders}
                </Badge>
                <Badge variant="outline" className="text-blue-600 border-blue-600 h-5 border-2 text-[10px] px-1.5 flex items-center justify-center">
                  ↓ {torrent.leechers}
                </Badge>
              </div>
            </div>

            {/* Upload Date */}
            <div className="flex flex-col gap-2">
              <div className="text-xs text-muted-foreground">上传时间</div>
              <div className="text-sm h-5 flex items-center">{formatDate(torrent.created_date)}</div>
            </div>

            {/* Remaining Time */}
            {torrent.remaining && (
              <div className="col-span-2 flex flex-col gap-2">
                <div className="text-xs text-muted-foreground">剩余时间</div>
                <div
                  className={`text-sm font-medium h-5 flex items-center ${
                    torrent.remaining.hours < 0.5 ? "text-red-600" : ""
                  }`}
                >
                  {torrent.remaining.display}
                </div>
              </div>
            )}
          </div>

          {/* Quality Metadata */}
          {torrent.quality_metadata && (
            <div>
              <div className="text-xs text-muted-foreground mb-2">质量信息</div>
              <div className="flex flex-wrap gap-2">
                {torrent.quality_metadata.resolution && (
                  <Badge variant="outline" className="h-5 border-2 text-[10px] px-1.5 flex items-center justify-center">{torrent.quality_metadata.resolution}</Badge>
                )}
                {torrent.quality_metadata.video_codec && (
                  <Badge variant="outline" className="h-5 border-2 text-[10px] px-1.5 flex items-center justify-center">{torrent.quality_metadata.video_codec}</Badge>
                )}
                {torrent.quality_metadata.audio_codec && (
                  <Badge variant="outline" className="h-5 border-2 text-[10px] px-1.5 flex items-center justify-center">{torrent.quality_metadata.audio_codec}</Badge>
                )}
                {torrent.quality_metadata.source && (
                  <Badge variant="outline" className="h-5 border-2 text-[10px] px-1.5 flex items-center justify-center">{torrent.quality_metadata.source}</Badge>
                )}
                {/* Labels (中字, DoVi, HDR, etc.) */}
                {torrent.quality_metadata.labels_new && torrent.quality_metadata.labels_new.length > 0 && (
                  torrent.quality_metadata.labels_new.map((label, idx) => (
                    <Badge key={idx} variant="outline" className="h-5 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 text-black dark:text-white text-[10px] px-1.5 flex items-center justify-center">
                      {label}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Fixed Bottom Action Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t-2 border-black dark:border-white bg-white dark:bg-zinc-900">
          <div className="flex gap-2">
            <Button
              onClick={() => onDownload(torrent.id)}
              disabled={!canDownload}
              className="flex-1 h-11 touch-manipulation"
              size="lg"
            >
              <Download className="h-4 w-4 mr-2" />
              {isDownloading ? "下载中..." : "下载"}
            </Button>
            <Button
              variant="outline"
              size="lg"
              asChild
              className="h-11 touch-manipulation"
            >
              <a
                href={torrent.detail_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
