/**
 * TorrentCard - Shared mobile card component for torrent display
 */

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { NumberTicker } from "@/components/common/number-ticker";
import {
  DiscountBadge,
  formatRelativeDate,
  getCategoryName,
} from "@/components/common/torrent-ui";
import type { Torrent } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TorrentCardProps {
  torrent: Torrent;
  onTap: (torrent: Torrent) => void;
  showRemaining?: boolean;
  hideDiscount?: boolean;
  showUploadTime?: boolean;
}

export function TorrentCard({
  torrent,
  onTap,
  showRemaining = false,
  hideDiscount = false,
  showUploadTime = false,
}: TorrentCardProps) {
  const urgent = Boolean(torrent.remaining && torrent.remaining.hours < 1);

  return (
    <Card
      className="cursor-pointer p-3 transition-transform active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      <button
        type="button"
        className="absolute inset-0 z-10 appearance-none rounded-2xl border-0 bg-transparent p-0 outline-none transition-[background-color,box-shadow] touch-manipulation hover:bg-accent/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        onClick={() => onTap(torrent)}
        aria-label={`查看种子详情：${torrent.name}`}
      />
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-medium leading-5">
            {torrent.name}
          </h3>
          {torrent.small_descr && (
            <p className="mt-1 line-clamp-1 text-muted-foreground text-xs">
              {torrent.small_descr}
            </p>
          )}
        </div>
        {showRemaining && torrent.remaining ? (
          <Badge
            variant={urgent ? "error" : "warning"}
            size="sm"
            className={cn(
              "max-w-24",
              urgent && "animate-pulse motion-reduce:animate-none"
            )}
          >
            {torrent.remaining.display}
          </Badge>
        ) : (
          !hideDiscount && <DiscountBadge discount={torrent.discount} />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-muted-foreground text-xs">
        <span className="font-medium tabular-nums">{torrent.size_display}</span>
        <Badge variant="secondary" size="sm">
          {getCategoryName(torrent.category)}
        </Badge>
        <Badge variant="success" size="sm">
          ↑ <NumberTicker value={torrent.seeders} />
        </Badge>
        <Badge variant="info" size="sm">
          ↓ <NumberTicker value={torrent.leechers} />
        </Badge>
        {showUploadTime && (
          <span className="ml-auto whitespace-nowrap">
            {formatRelativeDate(torrent.created_date)}
          </span>
        )}
      </div>
    </Card>
  );
}
