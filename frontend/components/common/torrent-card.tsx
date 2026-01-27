/**
 * TorrentCard - Shared mobile card component for torrent display
 * Used across SONAR, RADAR, and PANEL modules on mobile devices
 */

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Torrent } from "@/lib/types";
import { PARENT_CATEGORY_NAMES, CHILD_TO_PARENT } from "@/lib/constants";

interface TorrentCardProps {
  torrent: Torrent;
  onTap: (torrent: Torrent) => void;
}

export function TorrentCard({ torrent, onTap }: TorrentCardProps) {
  const getDiscountBadge = (discount: string) => {
    const styleMap: Record<string, { bg: string; color: string; label: string }> = {
      FREE: { bg: "#22c55e", color: "#ffffff", label: "免费" },
      "_2X_FREE": { bg: "#3b82f6", color: "#ffffff", label: "2x免费" },
      "_2X": { bg: "#a855f7", color: "#ffffff", label: "2x" },
      PERCENT_50: { bg: "#f97316", color: "#ffffff", label: "50%" },
      PERCENT_70: { bg: "#eab308", color: "#000000", label: "70%" },
      PERCENT_30: { bg: "#ef4444", color: "#ffffff", label: "30%" },
      NORMAL: { bg: "#e5e7eb", color: "#000000", label: "普通" },
    };

    const style = styleMap[discount] || styleMap.NORMAL;

    return (
      <span
        style={{
          backgroundColor: style.bg,
          color: style.color,
          borderColor: "#000000",
        }}
        className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest border-2 w-fit whitespace-nowrap transition-all rounded"
      >
        {style.label}
      </span>
    );
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

  return (
    <Card
      onClick={() => onTap(torrent)}
      className="p-3 cursor-pointer active:scale-[0.98] transition-transform touch-manipulation"
    >
      {/* Header: Name + Free Badge */}
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm line-clamp-2 leading-snug">
            {torrent.name}
          </h3>
        </div>
        {getDiscountBadge(torrent.discount)}
      </div>

      {/* Footer: Size + S/L + Category */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono font-medium">{torrent.size_display}</span>
        <span className="text-gray-300 dark:text-gray-700">•</span>
        <div className="flex gap-1">
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-green-600 border-green-600">
            ↑{torrent.seeders}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-blue-600 border-blue-600">
            ↓{torrent.leechers}
          </Badge>
        </div>
        <span className="text-gray-300 dark:text-gray-700">•</span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
          {getCategoryName(torrent.category)}
        </Badge>
      </div>
    </Card>
  );
}
