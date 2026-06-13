import type { TimeRange } from "@/lib/types";

const locale = "zh-CN";
const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;
const byteFormatter = new Intl.NumberFormat(locale, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatBytes(bytes: number) {
  if (bytes === 0) return `0 ${BYTE_UNITS[0]}`;

  const rawUnitIndex =
    bytes > 0 ? Math.floor(Math.log(bytes) / Math.log(1024)) : 0;
  const unitIndex = Math.min(
    BYTE_UNITS.length - 1,
    Math.max(0, rawUnitIndex),
  );

  const formattedValue = byteFormatter.format(
    bytes / Math.pow(1024, unitIndex),
  );
  return `${formattedValue} ${BYTE_UNITS[unitIndex]}`;
}

const relativeTimeFormatter = new Intl.RelativeTimeFormat(locale, {
  numeric: "auto",
});

const dateFormatter = new Intl.DateTimeFormat(locale, {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const panelPointDateTimeFormatter = new Intl.DateTimeFormat(locale, {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const panelTimeFormatter = new Intl.DateTimeFormat(locale, {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const panelDateTimeMinuteFormatter = new Intl.DateTimeFormat(locale, {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const panelDateTimeHourFormatter = new Intl.DateTimeFormat(locale, {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  hour12: false,
});

const panelDateFormatter = new Intl.DateTimeFormat(locale, {
  month: "numeric",
  day: "numeric",
});

const panelTooltipDateTimeFormatter = new Intl.DateTimeFormat(locale, {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function toDate(value: string | number | Date) {
  return value instanceof Date ? value : new Date(value);
}

function relativeValue(diffMs: number, unitMs: number) {
  const value = diffMs / unitMs;
  return diffMs < 0 ? Math.ceil(value) : Math.floor(value);
}

export function formatDate(value: string | number | Date) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "";

  return dateFormatter.format(date);
}

export function formatRelativeDate(
  value: string | number | Date,
  now: Date = new Date()
) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = date.getTime() - now.getTime();
  const absDiffMs = Math.abs(diffMs);
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (absDiffMs < hourMs) {
    return relativeTimeFormatter.format(relativeValue(diffMs, minuteMs), "minute");
  }

  if (absDiffMs < dayMs) {
    return relativeTimeFormatter.format(relativeValue(diffMs, hourMs), "hour");
  }

  if (absDiffMs < 7 * dayMs) {
    return relativeTimeFormatter.format(relativeValue(diffMs, dayMs), "day");
  }

  return formatDate(date);
}

export function formatPanelPointTime(timestamp: number) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";

  return panelPointDateTimeFormatter.format(date);
}

export function formatCompactDateTime(value: string | number | Date) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "";

  return panelPointDateTimeFormatter.format(date);
}

export function formatPanelTooltipDateTime(timestamp: number) {
  return panelTooltipDateTimeFormatter.format(new Date(timestamp));
}

export function formatPanelXAxisTick(timestamp: number, range: TimeRange) {
  const date = new Date(timestamp);

  switch (range) {
    case "6h":
      return panelTimeFormatter.format(date);
    case "24h":
      return panelDateTimeMinuteFormatter.format(date);
    case "7d":
      return panelDateTimeHourFormatter.format(date);
    case "30d":
      return panelDateFormatter.format(date);
    default:
      return panelTimeFormatter.format(date);
  }
}
