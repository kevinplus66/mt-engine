import type { ReactNode } from "react";
import { Download, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableHead } from "@/components/ui/table";
import { NumberTicker } from "@/components/common/number-ticker";
import { cn } from "@/lib/utils";

interface TorrentNameCellProps {
  name: string;
  description?: string | null;
  badges?: ReactNode;
  className?: string;
  descriptionClassName?: string;
  /** 提供时名称可点击，用于打开详情 Sheet */
  onOpen?: () => void;
}

export function TorrentNameCell({
  name,
  description,
  badges,
  className,
  descriptionClassName,
  onOpen,
}: TorrentNameCellProps) {
  const nameContent = (
    <span
      className="line-clamp-2 whitespace-normal break-words font-medium leading-5"
      title={name}
    >
      {name}
    </span>
  );

  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`查看种子详情：${name}`}
          className="block w-full max-w-[56rem] cursor-pointer rounded-sm text-left outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {nameContent}
        </button>
      ) : (
        <div className="max-w-[56rem]">{nameContent}</div>
      )}
      {description && (
        <div
          className={cn(
            "max-w-[56rem] truncate text-muted-foreground text-xs",
            descriptionClassName
          )}
        >
          {description}
        </div>
      )}
      {badges && <div className="flex max-w-[56rem] flex-wrap gap-1">{badges}</div>}
    </div>
  );
}

export function TorrentPeerBadges({
  seeders,
  leechers,
  animated = false,
}: {
  seeders?: number;
  leechers?: number;
  animated?: boolean;
}) {
  const seedersValue = seeders ?? 0;
  const leechersValue = leechers ?? 0;

  return (
    <div className="flex gap-1">
      <Badge variant="success" size="sm">
        ↑ {animated ? <NumberTicker value={seedersValue} /> : seedersValue}
      </Badge>
      <Badge variant="info" size="sm">
        ↓ {animated ? <NumberTicker value={leechersValue} /> : leechersValue}
      </Badge>
    </div>
  );
}

export function TorrentDownloadActions({
  detailUrl,
  onDownload,
  isDownloading,
  canDownload = true,
}: {
  detailUrl: string;
  onDownload: () => void;
  isDownloading: boolean;
  canDownload?: boolean;
}) {
  return (
    <>
      <Button
        size="icon-sm"
        onClick={onDownload}
        disabled={!canDownload || isDownloading}
        loading={isDownloading}
        aria-label="下载种子"
      >
        <Download className="size-4" aria-hidden="true" />
      </Button>
      <Button
        size="icon-sm"
        variant="outline"
        render={
          <a
            href={detailUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="查看详情"
          />
        }
      >
        <ExternalLink className="size-4" aria-hidden="true" />
      </Button>
    </>
  );
}

// 左侧渐变制造“内容滑入下方”的层次感；hover 背景跟随行高亮，避免悬停行出现死角
const stickyEdgeClassName =
  "sticky right-0 bg-card transition-colors before:pointer-events-none before:absolute before:inset-y-0 before:-left-3 before:w-3 before:bg-gradient-to-l before:from-black/6 before:to-transparent dark:before:from-black/24 group-hover/row:bg-[color-mix(in_srgb,var(--card),var(--color-black)_2%)] dark:group-hover/row:bg-[color-mix(in_srgb,var(--card),var(--color-white)_2%)]";

export function StickyActionHead({
  children = "操作",
  className,
  align = "center",
}: {
  children?: ReactNode;
  className?: string;
  align?: "center" | "right";
}) {
  return (
    <TableHead
      className={cn(
        stickyEdgeClassName,
        "z-20",
        align === "center" ? "text-center" : "text-right",
        className
      )}
    >
      {children}
    </TableHead>
  );
}

export function StickyActionCell({
  children,
  className,
  align = "center",
}: {
  children: ReactNode;
  className?: string;
  align?: "center" | "right";
}) {
  return (
    <TableCell
      className={cn(
        stickyEdgeClassName,
        "z-10",
        align === "center" ? "text-center" : "text-right",
        className
      )}
    >
      <div
        className={cn(
          "flex gap-1",
          align === "center" ? "justify-center" : "justify-end"
        )}
      >
        {children}
      </div>
    </TableCell>
  );
}
