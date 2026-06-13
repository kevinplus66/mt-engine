"use client";

import { Progress } from "@/components/ui/progress";
import {
  getSizeDisplay,
  type PanelTorrent,
} from "@/lib/panel-torrents";

interface TorrentProgressBlockProps {
  torrent: PanelTorrent;
}

export function TorrentProgressBlock({ torrent }: TorrentProgressBlockProps) {
  const percent = Math.round((torrent.progress || 0) * 100);

  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium tabular-nums">{percent}%</span>
        <span className="truncate text-muted-foreground">
          {getSizeDisplay(torrent)}
        </span>
      </div>
      <Progress value={percent} />
    </div>
  );
}
