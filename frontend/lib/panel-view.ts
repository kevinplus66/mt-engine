export type PanelTimeRange = "6h" | "24h" | "7d" | "30d";

export const PANEL_TIME_RANGE_OPTIONS = [
  { value: "6h" as const, label: "6 小时" },
  { value: "24h" as const, label: "24 小时" },
  { value: "7d" as const, label: "7 天" },
  { value: "30d" as const, label: "30 天" },
] satisfies readonly { value: PanelTimeRange; label: string }[];

export const PANEL_TIME_RANGES = PANEL_TIME_RANGE_OPTIONS.map(
  (option) => option.value,
);

export const DEFAULT_PANEL_TIME_RANGE: PanelTimeRange = "24h";

export function parsePanelTimeRange(value: string | null): PanelTimeRange {
  return PANEL_TIME_RANGES.includes(value as PanelTimeRange)
    ? (value as PanelTimeRange)
    : DEFAULT_PANEL_TIME_RANGE;
}
