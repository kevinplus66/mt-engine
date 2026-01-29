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
      <span className={`inline-flex items-center justify-center px-1.5 py-0 text-[10px] font-mono font-bold uppercase tracking-widest border-2 border-black dark:border-white bg-white dark:bg-zinc-900 ${style.color} w-fit whitespace-nowrap transition-all`}>
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
