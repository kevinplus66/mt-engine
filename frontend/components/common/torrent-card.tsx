/**
 * TorrentCard - Shared mobile card component for torrent display
 * Used across SONAR, RADAR, and PANEL modules on mobile devices
 */

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Torrent } from "@/lib/types";
import { PARENT_CATEGORY_NAMES, CHILD_TO_PARENT } from "@/lib/constants";
import { NumberTicker } from "@/components/common/number-ticker";

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
  showUploadTime = false
}: TorrentCardProps) {
  const getDiscountBadge = (discount: string) => {
    if (hideDiscount) return null;

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

  const getRemainingBadge = () => {
    if (!torrent.remaining) return null;
    
    const isUrgent = torrent.remaining.hours < 1;
    const colorClass = isUrgent 
      ? "text-red-600 border-red-600 dark:text-red-400 dark:border-red-400" 
      : "text-black border-black dark:text-white dark:border-white";

    return (
      <span className={`inline-flex items-center justify-center px-1.5 py-0 h-5 text-[10px] font-mono font-bold uppercase tracking-widest border-2 bg-white dark:bg-zinc-900 ${colorClass} w-fit whitespace-nowrap transition-all`}>
        {torrent.remaining.display}
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

  return (
    <Card
      onClick={() => onTap(torrent)}
      className="p-3 cursor-pointer active:scale-[0.98] transition-transform touch-manipulation"
    >
      {/* Header: Name + Badge */}
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm line-clamp-2 leading-snug">
            {torrent.name}
          </h3>
        </div>
        {showRemaining && torrent.remaining ? getRemainingBadge() : getDiscountBadge(torrent.discount)}
      </div>

      {/* Footer: Size + S/L + Category + Time */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono font-medium">{torrent.size_display}</span>
        <span className="text-gray-300 dark:text-gray-700">•</span>
        <div className="flex gap-1">
          <Badge variant="outline" className="text-[10px] px-1.5 h-5 flex items-center justify-center border-2 text-green-600 border-green-600">
            ↑<NumberTicker value={torrent.seeders} />
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 h-5 flex items-center justify-center border-2 text-blue-600 border-blue-600">
            ↓<NumberTicker value={torrent.leechers} />
          </Badge>
        </div>
        <span className="text-gray-300 dark:text-gray-700">•</span>
        <Badge variant="secondary" className="text-[10px] px-1.5 h-5 flex items-center justify-center border-2 border-black dark:border-white">
          {getCategoryName(torrent.category)}
        </Badge>
        
        {showUploadTime && (
          <span className="ml-auto font-mono text-[10px] text-muted-foreground whitespace-nowrap">
            {formatDate(torrent.created_date)}
          </span>
        )}
      </div>
    </Card>
  );
}
