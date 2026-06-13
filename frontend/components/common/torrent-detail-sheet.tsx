/**
 * TorrentDetailSheet - Full torrent details.
 * 移动端为底部抽屉，桌面端为右侧 inset sheet。
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DiscountBadge,
  formatRelativeDate,
  getCategoryName,
  QualityBadges,
  UserStatusBadge,
} from "@/components/common/torrent-ui";
import { Download, ExternalLink } from "lucide-react";
import { useIsMobile } from "@/hooks/use-media-query";
import type { Torrent } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TorrentDetailSheetProps {
  torrent: Torrent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenChangeComplete?: (open: boolean) => void;
  onDownload: (torrentId: string) => void;
  isDownloading: boolean;
}

function DetailItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-muted/28 p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-2 min-w-0 break-words text-sm font-medium">{children}</div>
    </div>
  );
}

export function TorrentDetailSheet({
  torrent,
  open,
  onOpenChange,
  onOpenChangeComplete,
  onDownload,
  isDownloading,
}: TorrentDetailSheetProps) {
  const isMobile = useIsMobile();

  if (!torrent) return null;

  const canDownload =
    torrent.user_status !== "seeding" &&
    torrent.user_status !== "leeching" &&
    !isDownloading;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
    >
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        variant={isMobile ? "default" : "inset"}
        className={cn(
          "min-w-0 p-0",
          isMobile ? "h-[76vh] rounded-t-2xl" : "w-[calc(100vw-1rem)] max-w-xl",
        )}
      >
        <SheetHeader className="min-w-0 border-b p-4 sm:p-5">
          <SheetTitle className="line-clamp-2 min-w-0 break-words pr-8 text-left text-base leading-6">
            {torrent.name}
          </SheetTitle>
        </SheetHeader>

        <SheetPanel className="min-w-0 p-4 sm:p-5">
          {torrent.small_descr && (
            <p className="mb-4 min-w-0 break-words text-muted-foreground text-sm leading-6">
              {torrent.small_descr}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <DetailItem label="分类">
              <Badge variant="secondary" size="sm">
                {getCategoryName(torrent.category)}
              </Badge>
            </DetailItem>
            <DetailItem label="优惠">
              <DiscountBadge discount={torrent.discount} />
            </DetailItem>
            <DetailItem label="大小">
              <span className="tabular-nums">{torrent.size_display}</span>
            </DetailItem>
            <DetailItem label="状态">
              <UserStatusBadge status={torrent.user_status} />
            </DetailItem>
            <DetailItem label="做种 / 下载">
              <span className="flex gap-1">
                <Badge variant="success" size="sm">
                  ↑ {torrent.seeders}
                </Badge>
                <Badge variant="info" size="sm">
                  ↓ {torrent.leechers}
                </Badge>
              </span>
            </DetailItem>
            <DetailItem label="上传时间">
              {formatRelativeDate(torrent.created_date)}
            </DetailItem>
            {torrent.remaining && (
              <DetailItem label="剩余时间">
                <Badge
                  variant={torrent.remaining.hours < 1 ? "error" : "warning"}
                  size="sm"
                >
                  {torrent.remaining.display}
                </Badge>
              </DetailItem>
            )}
          </div>

          {torrent.quality_metadata && (
            <div className="mt-4 rounded-xl border bg-muted/28 p-3">
              <div className="mb-2 text-muted-foreground text-xs">质量信息</div>
              <div className="flex flex-wrap gap-1.5">
                <QualityBadges torrent={torrent} />
              </div>
            </div>
          )}
        </SheetPanel>

        <SheetFooter className="flex-row gap-2 px-4 sm:px-5">
          <Button
            onClick={() => onDownload(torrent.id)}
            disabled={!canDownload}
            loading={isDownloading}
            className="flex-1"
            size="lg"
          >
            <Download className="size-4" aria-hidden="true" />
            下载
          </Button>
          <Button
            variant="outline"
            size="lg"
            render={
              <a
                href={torrent.detail_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="查看详情"
              />
            }
          >
            <ExternalLink className="size-4" aria-hidden="true" />
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
