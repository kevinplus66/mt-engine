"use client";

import { ChevronLeft, ChevronRight, Clapperboard, ExternalLink, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeferredSheetState } from "@/hooks/use-deferred-sheet-state";
import { useIsMobile } from "@/hooks/use-media-query";
import { formatCompactDateTime, formatRelativeDate } from "@/lib/formatters";
import type { MediaWallItem, MediaWallResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const mediaTypeLabels: Record<MediaWallItem["media_type"], string> = {
  movie: "电影",
  series: "剧集",
  other: "其他",
};

const numberFormatter = new Intl.NumberFormat("zh-CN");

function formatNumber(value: number) {
  return numberFormatter.format(value);
}


function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sumDiagnosticCounts(
  counts: NonNullable<MediaWallResponse["diagnostics"]>["sources"],
) {
  if (!counts) return 0;

  let total = 0;
  for (const key in counts) {
    const entry = counts[key];
    const count = finiteNumber(entry);
    total += count ?? (isRecord(entry) ? finiteNumber(entry.count) : null) ?? 0;
  }
  return total;
}

function sumRailDiagnosticCounts(
  rails: NonNullable<MediaWallResponse["diagnostics"]>["rails"],
  key: "relaxed" | "fallback",
  legacyKey: "relaxed_count" | "fallback_count",
) {
  if (!rails) return 0;

  let total = 0;
  for (const keyName in rails) {
    const rail = rails[keyName];
    if (!isRecord(rail)) continue;
    const count = finiteNumber(rail[key]);
    total += count ?? finiteNumber(rail[legacyKey]) ?? 0;
  }
  return total;
}

function formatDiagnostics(
  diagnostics: MediaWallResponse["diagnostics"],
): string | null {
  if (!diagnostics) return null;

  const sourceCount = sumDiagnosticCounts(diagnostics.sources);
  const relaxedCount = sumRailDiagnosticCounts(diagnostics.rails, "relaxed", "relaxed_count");
  const fallbackCount = sumRailDiagnosticCounts(diagnostics.rails, "fallback", "fallback_count");
  return `来源 ${formatNumber(sourceCount)} 项 · 放宽填充 ${formatNumber(relaxedCount)} 项 · 兜底 ${formatNumber(fallbackCount)} 项`;
}

const fallbackPosterPalettes = [
  {
    bg: "#171614",
    ink: "#f2eadb",
    muted: "rgba(242, 234, 219, 0.68)",
    accent: "#d6a84f",
    panel: "rgba(0, 0, 0, 0.28)",
    line: "rgba(242, 234, 219, 0.22)",
  },
  {
    bg: "#17252a",
    ink: "#e7f0ec",
    muted: "rgba(231, 240, 236, 0.66)",
    accent: "#8ab9a8",
    panel: "rgba(0, 0, 0, 0.24)",
    line: "rgba(231, 240, 236, 0.2)",
  },
  {
    bg: "#251b1f",
    ink: "#f5e7dd",
    muted: "rgba(245, 231, 221, 0.66)",
    accent: "#d58a72",
    panel: "rgba(0, 0, 0, 0.24)",
    line: "rgba(245, 231, 221, 0.2)",
  },
  {
    bg: "#1c2028",
    ink: "#ecedf0",
    muted: "rgba(236, 237, 240, 0.64)",
    accent: "#aeb8c7",
    panel: "rgba(0, 0, 0, 0.26)",
    line: "rgba(236, 237, 240, 0.2)",
  },
  {
    bg: "#241f16",
    ink: "#f3ecd7",
    muted: "rgba(243, 236, 215, 0.66)",
    accent: "#c9b06b",
    panel: "rgba(0, 0, 0, 0.25)",
    line: "rgba(243, 236, 215, 0.2)",
  },
];

interface HomeMediaWallProps {
  data: MediaWallResponse;
}

export function HomeMediaWall({ data }: HomeMediaWallProps) {
  const {
    item: selectedItem,
    open: isDetailOpen,
    openWithItem: openDetail,
    setOpen: setIsDetailOpen,
    reset: resetDetailSheet,
    handleOpenChangeComplete,
  } = useDeferredSheetState<MediaWallItem>();


  const totalItems = useMemo(
    () => data.rails.reduce((sum, rail) => sum + rail.items.length, 0),
    [data.rails],
  );

  useEffect(() => {
    if (!selectedItem) return;

    for (const rail of data.rails) {
      for (const item of rail.items) {
        if (item.id === selectedItem.id) return;
      }
    }

    resetDetailSheet();
  }, [data.rails, resetDetailSheet, selectedItem]);

  return (
    <div className="space-y-7">
      <MediaWallStatus data={data} totalItems={totalItems} />
      {data.rails.map((rail) => (
        <section
          key={rail.id}
          className="min-w-0 space-y-3 [contain-intrinsic-size:auto_24rem] [content-visibility:auto]"
        >
          <div className="min-w-0">
            <div className="flex min-w-0 items-start gap-2">
              <h2 className="min-w-0 flex-1 break-words text-balance font-heading font-semibold text-xl leading-tight">
                {rail.title}
              </h2>
              <Badge variant="outline" className="w-fit shrink-0">
                {formatNumber(rail.items.length)} 部
              </Badge>
            </div>
            <div className="min-w-0">
              <p className="mt-1 break-words text-muted-foreground text-pretty text-sm">
                {rail.description}
              </p>
            </div>
          </div>

          {rail.items.length > 0 ? (
            <MediaRailScroller label={rail.title}>
              {rail.items.map((item, index) => (
                <MediaPosterCard
                  key={`${rail.id}-${item.id}`}
                  item={item}
                  eager={rail.id === data.rails[0]?.id && index === 0}
                  onOpen={() => openDetail(item)}
                />
              ))}
            </MediaRailScroller>
          ) : (
            <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-7 text-center text-muted-foreground text-sm">
              <p>当前筛选分组暂无匹配资源</p>
            </div>
          )}
        </section>
      ))}

      <MediaDetailSheet
        item={selectedItem}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onOpenChangeComplete={handleOpenChangeComplete}
      />
    </div>
  );
}

function MediaRailScroller({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);

  const scrollByPage = useCallback((direction: -1 | 1) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    viewport.scrollBy({
      left: direction * Math.max(240, viewport.clientWidth * 0.82),
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      if (viewport.scrollWidth <= viewport.clientWidth) return;

      const horizontalIntent = Math.abs(event.deltaX) > 0.5;
      if (horizontalIntent || event.shiftKey || event.deltaY === 0) {
        return;
      }

      // Pixel-mode wheel events are typically trackpads / Apple pointing devices.
      // Let Safari/Chrome handle those natively so OS-tuned inertia stays intact.
      if (event.deltaMode === 0) return;

      const deltaUnit =
        event.deltaMode === 1
          ? 16
          : viewport.clientWidth;
      const delta = event.deltaY * deltaUnit * 0.65;
      const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;
      const nextScrollLeft = Math.min(
        maxScrollLeft,
        Math.max(0, viewport.scrollLeft + delta),
      );
      if (nextScrollLeft === viewport.scrollLeft) return;

      event.preventDefault();
      viewport.scrollLeft = nextScrollLeft;
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, []);


  return (
    <div className="group/rail relative -mx-3 sm:-mx-4 lg:-mx-6">
      <div
        ref={viewportRef}
        aria-label={`${label} 横向资源列表`}
        className="touch-pan-x overflow-x-auto px-3 pb-3 [overscroll-behavior-inline:contain] [-webkit-overflow-scrolling:touch] sm:px-4 lg:px-6"
        role="region"
        tabIndex={0}
      >
        <div className="grid w-max auto-cols-[minmax(9.25rem,10.5rem)] grid-flow-col gap-3 [contain:layout_paint_style] sm:auto-cols-[minmax(10.5rem,12rem)] lg:auto-cols-[minmax(11rem,12.5rem)]">
          {children}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-2 right-2 hidden items-center justify-between sm:flex">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="pointer-events-auto size-9 rounded-full border bg-background/90 opacity-0 shadow-md backdrop-blur transition-opacity motion-reduce:transition-none group-hover/rail:opacity-100 group-focus-within/rail:opacity-100"
          aria-label={`向左滚动${label}`}
          onClick={() => scrollByPage(-1)}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="pointer-events-auto size-9 rounded-full border bg-background/90 opacity-0 shadow-md backdrop-blur transition-opacity motion-reduce:transition-none group-hover/rail:opacity-100 group-focus-within/rail:opacity-100"
          aria-label={`向右滚动${label}`}
          onClick={() => scrollByPage(1)}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
function MediaWallStatus({
  data,
  totalItems,
}: {
  data: MediaWallResponse;
  totalItems: number;
}) {
  const lastRefreshed = data.last_refreshed
    ? formatCompactDateTime(data.last_refreshed)
    : "等待首次刷新";
  const nextRefresh = data.next_refresh
    ? formatCompactDateTime(data.next_refresh)
    : "后台调度中";
  const diagnostics = useMemo(
    () => formatDiagnostics(data.diagnostics),
    [data.diagnostics],
  );
  const warning = totalItems > 0
    ? "正在显示已缓存内容；刷新异常已记录，后台会在下一轮刷新。"
    : "媒体墙刷新暂未产生可展示资源，后台会在下一轮刷新。";

  return (
    <div className="grid gap-3 rounded-xl border bg-card p-4 shadow-xs/5 sm:grid-cols-3">
      <StatusMetric label="媒体缓存" value={`${formatNumber(totalItems)} 项`} />
      <StatusMetric label="最近刷新" value={lastRefreshed} />
      <StatusMetric label="下次刷新" value={nextRefresh} />
      {diagnostics && (
        <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 break-words text-muted-foreground text-pretty text-sm sm:col-span-3">
          {diagnostics}
        </div>
      )}
      {(data.stale || data.refresh_status === "error") && (
        <div className="rounded-lg border border-warning/25 bg-warning/8 px-3 py-2 break-words text-sm text-pretty text-warning-foreground sm:col-span-3">
          {warning}
        </div>
      )}
    </div>
  );
}

function StatusMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-1 truncate font-heading font-semibold text-lg tabular-nums">
        {value}
      </div>
    </div>
  );
}

function MediaPosterCard({
  item,
  eager = false,
  onOpen,
}: {
  item: MediaWallItem;
  eager?: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`查看 ${item.title} 的详情`}
      onClick={onOpen}
      className="group/poster flex min-w-0 touch-manipulation flex-col text-left outline-none [-webkit-tap-highlight-color:transparent] motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-apple motion-safe:active:scale-[0.97]"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border bg-muted shadow-xs/5 transition-[border-color,box-shadow] group-hover/poster:border-primary/24 group-hover/poster:shadow-md group-focus-visible/poster:ring-2 group-focus-visible/poster:ring-ring group-focus-visible/poster:ring-offset-2 group-focus-visible/poster:ring-offset-background motion-reduce:transition-none">
        <PosterArtwork
          item={item}
          eager={eager}
          sizes="(max-width: 640px) 42vw, (max-width: 1024px) 20vw, 200px"
        />
        <div className="absolute inset-x-2 bottom-2 flex flex-wrap gap-1">
          <Badge size="sm" variant="secondary" className="backdrop-blur">
            {mediaTypeLabels[item.media_type]}
          </Badge>
          {item.episode && (
            <Badge size="sm" variant="outline" className="bg-background/88">
              {item.episode}
            </Badge>
          )}
        </div>
      </div>
      <div className="mt-2 min-w-0 space-y-1">
        <div className="line-clamp-2 min-h-10 break-words text-pretty font-medium text-sm leading-5">
          {item.title}
        </div>
        <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
          {item.year && <span className="shrink-0">{item.year}</span>}
          <span className="line-clamp-1 min-w-0 break-words">{item.rail_reason}</span>
        </div>
      </div>
    </button>
  );
}

function MediaDetailSheet({
  item,
  open,
  onOpenChange,
  onOpenChangeComplete,
}: {
  item: MediaWallItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenChangeComplete: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();
  if (!item) return null;
  const radarHref = buildRadarHref(item);
  const rating = firstString(item.douban_rating, item.imdb_rating);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
    >
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        variant={isMobile ? "default" : "inset"}
        motionPreset={isMobile ? "standard" : "wide"}
        className={cn(
          "p-0",
          isMobile
            ? "h-[82vh] rounded-t-2xl"
            : "w-[calc(100vw-1rem)] max-w-2xl",
        )}
      >
        <SheetHeader className="border-b p-4 sm:p-5">
          <div className="flex min-w-0 gap-4 pr-9">
            <div className="relative hidden aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-lg border bg-muted sm:block">
              <PosterArtwork item={item} sizes="96px" compact />
            </div>
            <div className="min-w-0">
              <SheetTitle className="break-words text-left text-2xl text-balance leading-tight">
                {item.title}
              </SheetTitle>
              <SheetDescription className="mt-2 line-clamp-2 break-words text-left text-pretty">
                {item.torrent_name}
              </SheetDescription>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge variant="secondary">
                  {mediaTypeLabels[item.media_type]}
                </Badge>
                {item.year && (
                  <Badge variant="outline">{item.year}</Badge>
                )}
                {item.episode && (
                  <Badge variant="outline" className="break-words">
                    {item.episode}
                  </Badge>
                )}
                {rating && <Badge variant="warning">评分 {rating}</Badge>}
              </div>
            </div>
          </div>
        </SheetHeader>

        <SheetPanel className="space-y-5 p-4 sm:p-5">
          {item.description && (
            <p className="break-words text-muted-foreground text-pretty text-sm leading-6">
              {item.description}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <DetailMetric label="大小" value={item.size_display} />
            <DetailMetric
              label="上传时间"
              value={formatRelativeDate(item.created_date)}
            />
            <DetailMetric
              label="做种"
              value={formatNumber(item.seeders)}
            />
            <DetailMetric
              label="下载者"
              value={formatNumber(item.leechers)}
            />
            <DetailMetric
              label="完成"
              value={formatNumber(item.times_completed)}
            />
            <DetailMetric
              label="优惠"
              value={
                <span translate="no">{item.discount || "NORMAL"}</span>
              }
            />
          </div>

          {item.quality_tags.length > 0 && (
            <div className="rounded-xl border bg-muted/24 p-3">
              <div className="mb-2 text-muted-foreground text-xs">质量标签</div>
              <div className="flex flex-wrap gap-1.5">
                {item.quality_tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="break-words">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </SheetPanel>

        <SheetFooter className="gap-2">
          <SheetClose render={<Button variant="outline" />}>关闭</SheetClose>
          <Button
            variant="outline"
            render={<Link href={radarHref} />}
          >
            <Search className="size-4" aria-hidden="true" />
            在 <span translate="no">RADAR</span> 搜索
          </Button>
          <Button
            render={
              <a
                href={item.detail_url}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            打开 <span translate="no">M-Team</span>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function DetailMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border bg-muted/24 p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-2 truncate font-medium tabular-nums">{value || "-"}</div>
    </div>
  );
}

function PosterArtwork({
  item,
  eager = false,
  sizes,
  compact = false,
}: {
  item: MediaWallItem;
  eager?: boolean;
  sizes: string;
  compact?: boolean;
}) {
  const [failedPosterUrl, setFailedPosterUrl] = useState<string | null>(null);

  if (item.poster_url && item.poster_url !== failedPosterUrl) {
    return (
      <Image
        src={item.poster_url}
        alt={`${item.title} 海报`}
        width={480}
        height={720}
        unoptimized
        sizes={sizes}
        className="size-full object-cover"
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        referrerPolicy="no-referrer"
        onError={() => setFailedPosterUrl(item.poster_url || null)}
      />
    );
  }

  return <FallbackPosterArtwork compact={compact} item={item} />;
}

function FallbackPosterArtwork({
  item,
  compact = false,
}: {
  item: MediaWallItem;
  compact?: boolean;
}) {
  const style = fallbackPosterStyle(item);
  const titleToken = compact ? item.title.slice(0, 1).toUpperCase() : item.title;
  const primaryTag =
    item.episode || item.year || item.quality_tags[0] || mediaTypeLabels[item.media_type];
  const quality = item.quality_tags.slice(0, compact ? 1 : 2).join(" / ");

  return (
    <div
      className="relative size-full overflow-hidden bg-[var(--poster-bg)] text-[var(--poster-ink)]"
      style={style}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,var(--poster-accent),transparent_24%),linear-gradient(160deg,transparent_18%,rgba(255,255,255,0.08)_46%,transparent_58%)] opacity-50" />
      <div className="absolute -right-10 -top-8 size-28 rounded-full border border-[color:var(--poster-line)]" />
      <div className="absolute -bottom-12 left-4 h-32 w-20 rotate-12 rounded-full border border-[color:var(--poster-line)]" />
      <div className="absolute inset-x-3 top-3 flex min-w-0 items-center justify-between gap-2 text-[0.55rem] font-semibold uppercase text-[var(--poster-muted)]">
        <span className="min-w-0 truncate">{mediaTypeLabels[item.media_type]}</span>
        <span className="min-w-0 truncate">{primaryTag}</span>
      </div>
      <div className="relative flex size-full flex-col justify-end p-3">
        <div className="mb-2 h-px w-full bg-[var(--poster-line)]" />
        <div
          className={
            compact
              ? "break-words font-heading font-semibold text-2xl leading-none"
              : "line-clamp-4 break-words text-pretty font-heading font-semibold text-base leading-tight"
          }
        >
          {titleToken}
        </div>
        {!compact && (
          <>
            <div className="mt-2 line-clamp-2 break-words text-[0.68rem] leading-4 text-[var(--poster-muted)]">
              {quality || item.rail_reason}
            </div>
            <div className="mt-3 flex min-w-0 items-center justify-between gap-2 rounded-md border border-[color:var(--poster-line)] bg-[var(--poster-panel)] px-2 py-1 text-[0.6875rem] font-medium text-[var(--poster-muted)]">
              <span translate="no">M-Team</span>
              <span className="min-w-0 truncate">{item.size_display}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function fallbackPosterStyle(item: MediaWallItem): CSSProperties {
  const palette =
    fallbackPosterPalettes[hashString(item.media_key || item.title) % fallbackPosterPalettes.length];
  return {
    "--poster-bg": palette.bg,
    "--poster-ink": palette.ink,
    "--poster-muted": palette.muted,
    "--poster-accent": palette.accent,
    "--poster-panel": palette.panel,
    "--poster-line": palette.line,
  } as CSSProperties;
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    return typeof value === "number" ? formatNumber(value) : String(value);
  }
  return "";
}

function buildRadarHref(item: MediaWallItem) {
  const params = new URLSearchParams();
  params.set("keyword", item.title);
  return `/radar?${params.toString()}`;
}

export function HomeMediaWallLoading() {
  return (
    <div className="space-y-7">
      <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3">
        <Skeleton className="h-12 motion-reduce:animate-none" />
        <Skeleton className="h-12 motion-reduce:animate-none" />
        <Skeleton className="h-12 motion-reduce:animate-none" />
      </div>
      {[0, 1, 2, 3, 4].map((section) => (
        <section
          key={section}
          className="min-w-0 space-y-3 [contain-intrinsic-size:auto_24rem] [content-visibility:auto]"
        >
          <Skeleton className="h-8 w-44 motion-reduce:animate-none" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="min-w-0 space-y-2">
                <Skeleton className="aspect-[2/3] rounded-xl motion-reduce:animate-none" />
                <Skeleton className="h-5 motion-reduce:animate-none" />
                <Skeleton className="h-4 w-2/3 motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function EmptyMediaWall() {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-14 text-center">
      <Clapperboard
        className="mx-auto mb-4 size-8 text-muted-foreground"
        aria-hidden="true"
      />
      <h2 className="break-words text-balance font-heading font-semibold text-xl">
        等待媒体墙刷新
      </h2>
      <p className="mx-auto mt-2 max-w-md break-words text-muted-foreground text-pretty text-sm leading-6">
        后台会错峰刷新 <span translate="no">M-Team</span> 媒体缓存，
        <span translate="no">Home</span> 页面只读取缓存，不会在访问时触发{" "}
        <span translate="no">M-Team</span> 请求。
      </p>
    </div>
  );
}
