import { Badge } from "@/components/ui/badge";
import { CHILD_TO_PARENT, PARENT_CATEGORY_NAMES } from "@/lib/constants";
import { formatRelativeDate as formatRelativeDateValue } from "@/lib/formatters";
import type { Torrent } from "@/lib/types";
import { cn } from "@/lib/utils";

const discountMap: Record<
  string,
  { label: string; variant: "success" | "info" | "warning" | "error" | "outline" }
> = {
  FREE: { label: "免费", variant: "success" },
  _2X_FREE: { label: "2X 免费", variant: "info" },
  _2X: { label: "2X", variant: "info" },
  PERCENT_50: { label: "50%", variant: "warning" },
  PERCENT_70: { label: "70%", variant: "warning" },
  PERCENT_30: { label: "30%", variant: "error" },
  NORMAL: { label: "普通", variant: "outline" },
};

export function getCategoryName(categoryId: number) {
  if (PARENT_CATEGORY_NAMES[categoryId]) {
    return PARENT_CATEGORY_NAMES[categoryId];
  }

  const parentId = CHILD_TO_PARENT[categoryId];
  if (parentId && PARENT_CATEGORY_NAMES[parentId]) {
    return PARENT_CATEGORY_NAMES[parentId];
  }

  return "未知";
}

export function formatRelativeDate(dateString: string) {
  return formatRelativeDateValue(dateString);
}

export function DiscountBadge({
  discount,
  className,
}: {
  discount: string;
  className?: string;
}) {
  const discountStyle = discountMap[discount] || discountMap.NORMAL;

  return (
    <Badge
      variant={discountStyle.variant}
      size="sm"
      className={cn("max-w-full", className)}
    >
      {discountStyle.label}
    </Badge>
  );
}

export function UserStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  if (status === "seeding" || status === "uploading") {
    return (
      <Badge variant="success" size="sm" className={className}>
        做种中
      </Badge>
    );
  }

  if (status === "leeching" || status === "downloading") {
    return (
      <Badge variant="info" size="sm" className={className}>
        下载中
      </Badge>
    );
  }

  if (
    status === "pausedDL" ||
    status === "pausedUP" ||
    status === "stoppedDL" ||
    status === "stoppedUP"
  ) {
    return (
      <Badge variant="secondary" size="sm" className={className}>
        已暂停
      </Badge>
    );
  }

  return (
    <Badge variant="outline" size="sm" className={className}>
      {status === "none" ? "未下载" : status}
    </Badge>
  );
}

export function QualityBadges({ torrent }: { torrent: Torrent }) {
  const quality = torrent.quality_metadata;
  const labels = [
    quality?.country,
    quality?.resolution,
    quality?.video_codec,
    quality?.audio_codec,
    quality?.source,
    ...(quality?.labels_new || []),
  ].filter(Boolean);

  if (labels.length === 0) return null;

  return (
    <>
      {labels.slice(0, 5).map((label) => (
        <Badge key={String(label)} variant="outline" size="sm">
          {label}
        </Badge>
      ))}
    </>
  );
}
