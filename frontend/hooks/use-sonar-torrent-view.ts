"use client";

import { useMemo } from "react";
import type { ModeFilter, RemainingFilter } from "@/components/sonar/dropdown-filters";
import type { SeederFilter, SizeFilter } from "@/components/sonar/filter-pills";
import { useSortable } from "@/hooks/use-sortable";
import {
  sortData,
  torrentSortExtractors,
} from "@/lib/sort-utils";
import type {
  SonarSortField,
  UserStatus,
} from "@/lib/sonar-view";
import type { Torrent } from "@/lib/types";

interface UseSonarTorrentViewOptions {
  torrents?: Torrent[];
  statusFilter: UserStatus;
  search: string;
  sizeFilter: SizeFilter;
  seederFilter: SeederFilter;
  remainingFilter: RemainingFilter;
  modeFilter: ModeFilter;
  page: number;
  pageSize: number;
}

type SonarFilterOptions = Omit<
  UseSonarTorrentViewOptions,
  "torrents" | "page" | "pageSize"
>;

export function matchesSonarFilters(
  torrent: Torrent,
  {
    statusFilter,
    search,
    sizeFilter,
    seederFilter,
    remainingFilter,
    modeFilter,
  }: SonarFilterOptions,
  normalizedSearch = search.toLowerCase(),
) {
  if (statusFilter !== "all" && torrent.user_status !== statusFilter) {
    return false;
  }

  if (
    normalizedSearch &&
    !torrent.name.toLowerCase().includes(normalizedSearch)
  ) {
    return false;
  }

  const sizeGB = torrent.size / 1024 ** 3;
  if (sizeFilter === "small" && sizeGB >= 10) return false;
  if (sizeFilter === "medium" && (sizeGB < 10 || sizeGB >= 50)) return false;
  if (sizeFilter === "large" && (sizeGB < 50 || sizeGB >= 100)) return false;
  if (sizeFilter === "xlarge" && sizeGB < 100) return false;

  if (seederFilter === "hot" && torrent.seeders <= 10) return false;
  if (seederFilter === "normal" && (torrent.seeders < 5 || torrent.seeders > 10)) {
    return false;
  }
  if (seederFilter === "rare" && (torrent.seeders < 1 || torrent.seeders > 4)) {
    return false;
  }
  if (seederFilter === "dead" && torrent.seeders !== 0) return false;

  if (remainingFilter !== "all") {
    if (!torrent.remaining) return false;

    const hours = torrent.remaining.hours || 0;
    if (remainingFilter === "critical" && hours >= 1) return false;
    if (remainingFilter === "danger" && (hours < 1 || hours >= 2)) return false;
    if (remainingFilter === "warning" && (hours < 2 || hours >= 6)) return false;
    if (remainingFilter === "safe" && (hours < 6 || hours >= 24)) return false;
    if (remainingFilter === "plenty" && hours < 24) return false;
  }

  if (modeFilter === "normal" && torrent.mode === "adult") return false;
  if (modeFilter === "adult" && torrent.mode !== "adult") return false;

  return true;
}

export function useSonarTorrentView(options: UseSonarTorrentViewOptions) {
  const {
    torrents,
    statusFilter,
    search,
    sizeFilter,
    seederFilter,
    remainingFilter,
    modeFilter,
    page,
    pageSize,
  } = options;

  const { sortField, sortDirection, handleSort, getSortDirection } =
    useSortable<SonarSortField>({
      defaultField: "remaining",
      defaultDirection: "asc",
    });

  const filteredTorrents = useMemo(() => {
    const normalizedSearch = search.toLowerCase();

    return torrents?.filter((torrent) =>
      matchesSonarFilters(
        torrent,
        {
          statusFilter,
          search,
          sizeFilter,
          seederFilter,
          remainingFilter,
          modeFilter,
        },
        normalizedSearch,
      ),
    );
  }, [
    torrents,
    statusFilter,
    search,
    sizeFilter,
    seederFilter,
    remainingFilter,
    modeFilter,
  ]);

  const sortedTorrents = useMemo(() => {
    if (!filteredTorrents) return [];
    return sortData(
      filteredTorrents,
      sortField,
      sortDirection,
      torrentSortExtractors,
    );
  }, [filteredTorrents, sortField, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(sortedTorrents.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedTorrents = sortedTorrents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return {
    sortedTorrents,
    pagedTorrents,
    pageCount,
    currentPage,
    handleSort,
    getSortDirection,
  };
}
