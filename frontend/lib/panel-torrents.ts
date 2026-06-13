import type { BackendPanelTorrentsResponse } from "@/lib/api-models";

export type StatusFilter = "all" | "downloading" | "seeding" | "paused";
export type PanelSortField = "name" | "progress";
export type PanelTorrent = NonNullable<
  BackendPanelTorrentsResponse["torrents"]
>[number];

export const MONITOR_STATUS_QUERY_PARAM = "monitorStatus";
export const PANEL_MONITOR_PAGE_SIZE = 50;

export const panelStatusOptions = [
  { value: "all" as const, label: "全部" },
  { value: "downloading" as const, label: "下载中" },
  { value: "seeding" as const, label: "做种中" },
  { value: "paused" as const, label: "已暂停" },
];

const statusFilterValues = panelStatusOptions.map((button) => button.value);

const byteUnits = [
  "byte",
  "kilobyte",
  "megabyte",
  "gigabyte",
  "terabyte",
] as const;

type ByteUnit = (typeof byteUnits)[number];

const byteFormatters = new Map<ByteUnit, Intl.NumberFormat>();

function getByteFormatter(unit: ByteUnit) {
  const formatter = byteFormatters.get(unit);
  if (formatter) return formatter;

  const nextFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: unit === "byte" ? 0 : 2,
    style: "unit",
    unit,
    unitDisplay: "narrow",
  });
  byteFormatters.set(unit, nextFormatter);
  return nextFormatter;
}

export function formatBytes(bytes: number) {
  const safeBytes = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (safeBytes === 0) return getByteFormatter("byte").format(0);

  const exponent = Math.min(
    Math.floor(Math.log(safeBytes) / Math.log(1024)),
    byteUnits.length - 1,
  );
  const unit = byteUnits[exponent];

  return getByteFormatter(unit).format(safeBytes / 1024 ** exponent);
}

export function isStatusFilter(value: string | null): value is StatusFilter {
  return statusFilterValues.includes(value as StatusFilter);
}

export function isPaused(status = "") {
  return (
    status === "pausedDL" ||
    status === "pausedUP" ||
    status === "stoppedDL" ||
    status === "stoppedUP"
  );
}

export function getStatusFromState(state = ""): StatusFilter {
  if (state.includes("downloading") || state === "stalledDL" || state === "metaDL") {
    return "downloading";
  }
  if (state.includes("uploading") || state === "stalledUP" || state === "seeding") {
    return "seeding";
  }
  if (state.includes("paused") || state.includes("stopped")) {
    return "paused";
  }
  return "all";
}

export function getPanelTorrentKey(torrent: PanelTorrent) {
  return torrent.hash || torrent.id || "";
}

export function getSizeDisplay(torrent: PanelTorrent) {
  if (typeof torrent.size === "number" && torrent.size >= 0) {
    return formatBytes(torrent.size);
  }

  if (torrent.size_display) {
    const sizeDisplay = String(torrent.size_display).trim();
    if (/[A-Za-z]/.test(sizeDisplay)) return sizeDisplay;

    const sizeInGiB = Number(sizeDisplay);
    if (Number.isFinite(sizeInGiB)) {
      return formatBytes(sizeInGiB * 1024 ** 3);
    }

    return sizeDisplay;
  }

  return formatBytes(0);
}
