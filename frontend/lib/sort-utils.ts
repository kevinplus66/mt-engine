/**
 * Sort Utilities - Generic client-side sorting functions
 */

import type { SortDirection } from "@/hooks/use-sortable";
import type { Torrent } from "./types";

export type SortValueExtractor<T> = (
  item: T
) => string | number | Date | null | undefined;

/**
 * Generic sort function for client-side sorting
 * Handles strings, numbers, dates, and null/undefined values
 */
export function sortData<T, K extends string = string>(
  data: T[],
  field: K,
  direction: SortDirection,
  extractors: Record<K, SortValueExtractor<T>>
): T[] {
  const extractor = extractors[field];
  if (!extractor) return data;

  return [...data].sort((a, b) => {
    const valueA = extractor(a);
    const valueB = extractor(b);

    // Handle null/undefined - push to end
    if (valueA == null && valueB == null) return 0;
    if (valueA == null) return 1;
    if (valueB == null) return -1;

    let comparison = 0;

    if (typeof valueA === "string" && typeof valueB === "string") {
      comparison = valueA.localeCompare(valueB, "zh-CN");
    } else if (valueA instanceof Date && valueB instanceof Date) {
      comparison = valueA.getTime() - valueB.getTime();
    } else {
      comparison = Number(valueA) - Number(valueB);
    }

    return direction === "asc" ? comparison : -comparison;
  });
}

/**
 * Pre-built extractors for Torrent type (SONAR & RADAR)
 */
export const torrentSortExtractors = {
  name: (t: Torrent) => t.name,
  size: (t: Torrent) => t.size,
  seeders: (t: Torrent) => t.seeders,
  leechers: (t: Torrent) => t.leechers,
  time: (t: Torrent) => new Date(t.created_date),
  remaining: (t: Torrent) => t.remaining?.hours ?? Infinity,
} as const;

/**
 * Pre-built extractors for Panel torrents
 * Adjust based on actual Panel torrent type structure
 */
export const panelTorrentSortExtractors = {
  name: (t: any) => t.name,
  progress: (t: any) => t.progress ?? 0,
  size: (t: any) => t.size ?? 0,
  seeders: (t: any) => t.seeders ?? 0,
} as const;

/**
 * API sort field mapping for RADAR (server-side sorting)
 * Maps internal field names to API field names
 */
export const RADAR_SORT_FIELD_MAP: Record<string, string> = {
  name: "NAME",
  size: "SIZE",
  seeders: "SEEDERS",
  time: "CREATED_DATE",
} as const;
