import { describe, expect, it } from "vitest";
import { matchesSonarFilters } from "../hooks/use-sonar-torrent-view";
import type { Torrent } from "../lib/types";

const baseTorrent: Torrent = {
  id: "sonar-filter-torrent",
  name: "Case Matched Release",
  size: 8 * 1024 ** 3,
  size_display: "8 GB",
  seeders: 5,
  leechers: 0,
  discount: "FREE",
  discount_label: "FREE",
  created_date: "2026-06-04",
  detail_url: "https://example.test/torrents/sonar-filter-torrent",
  user_status: "none",
  category: 401,
  mode: "normal",
};

const baseFilters = {
  statusFilter: "all",
  search: "",
  sizeFilter: "all",
  remainingFilter: "all",
  modeFilter: "all",
} as const;

function torrentWithSeeders(seeders: number): Torrent {
  return {
    ...baseTorrent,
    id: `seeders-${seeders}`,
    seeders,
  };
}

describe("SONAR seeder filters", () => {
  it("includes exactly 5 seeders in normal but not rare", () => {
    const torrent = torrentWithSeeders(5);

    expect(
      matchesSonarFilters(torrent, {
        ...baseFilters,
        seederFilter: "normal",
      }),
    ).toBe(true);
    expect(
      matchesSonarFilters(torrent, {
        ...baseFilters,
        seederFilter: "rare",
      }),
    ).toBe(false);
  });

  it("includes 4 seeders in rare", () => {
    expect(
      matchesSonarFilters(torrentWithSeeders(4), {
        ...baseFilters,
        seederFilter: "rare",
      }),
    ).toBe(true);
  });
});

describe("SONAR search filters", () => {
  it("matches active search case-insensitively", () => {
    expect(
      matchesSonarFilters(baseTorrent, {
        ...baseFilters,
        search: "case matched",
        seederFilter: "all",
      }),
    ).toBe(true);
    expect(
      matchesSonarFilters(baseTorrent, {
        ...baseFilters,
        search: "CASE MATCHED",
        seederFilter: "all",
      }),
    ).toBe(true);
  });
});
