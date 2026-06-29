import { act, renderHook } from "@testing-library/react";
import type { KeyedMutator } from "swr";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "@/lib/toast";
import { deletePanelTorrents } from "@/lib/api";
import { historyFetcher } from "../hooks/use-panel-history";
import { usePanelTorrentActions } from "../hooks/use-panel-torrent-actions";
import { shareRatioFetcher } from "../hooks/use-panel-share-ratio";
import { torrentsFetcher } from "../hooks/use-panel-torrents";
import { fetcher } from "../lib/api";
import { CONFIG } from "../lib/constants";
import type { PanelTorrent } from "../lib/panel-torrents";
import { matchesSonarFilters } from "../hooks/use-sonar-torrent-view";
import type { Torrent } from "../lib/types";

vi.mock("@/lib/toast", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    deletePanelTorrents: vi.fn(),
  };
});

const panelError = "PANEL collector unavailable";
const originalApiBase = CONFIG.API_BASE;

function setApiBase(apiBase: string) {
  (CONFIG as { API_BASE: string }).API_BASE = apiBase;
}

function stubPanelResponse(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
}

afterEach(() => {
  setApiBase(originalApiBase);
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("PANEL fetchers", () => {
  it("prefixes relative API SWR keys without changing already-prefixed or non-API URLs", async () => {
    setApiBase("/panel-base");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      void input;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetcher("/api/panel/torrents");
    await fetcher("/panel-base/api/panel/torrents");
    await fetcher("https://example.test/api/panel/torrents");
    await fetcher("/health");

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/panel-base/api/panel/torrents",
      "/panel-base/api/panel/torrents",
      "https://example.test/api/panel/torrents",
      "/health",
    ]);
  });

  it("propagates torrent response errors to SWR", async () => {
    stubPanelResponse({ error: panelError, torrents: [] });

    await expect(torrentsFetcher("/api/panel/torrents")).rejects.toThrow(
      panelError,
    );
  });

  it("propagates history response errors to SWR", async () => {
    stubPanelResponse({ error: panelError, data_points: [] });

    await expect(
      historyFetcher("/api/panel/history?range=24h"),
    ).rejects.toThrow(panelError);
  });

  it("propagates share-ratio response errors to SWR", async () => {
    stubPanelResponse({ error: panelError, data_points: [] });

    await expect(
      shareRatioFetcher("/api/panel/share-ratio?range=24h"),
    ).rejects.toThrow(panelError);
  });

  it("stops carrying traffic after cumulative counters go flat", async () => {
    stubPanelResponse({
      range: "24h",
      aggregation: "none",
      data_points: [
        { timestamp: 0, mteam: { uploaded: 100, downloaded: 200 } },
        { timestamp: 60, mteam: { uploaded: 160, downloaded: 260 } },
        { timestamp: 120, mteam: { uploaded: 160, downloaded: 260 } },
        { timestamp: 180, mteam: { uploaded: 160, downloaded: 260 } },
        { timestamp: 240, mteam: { uploaded: 160, downloaded: 260 } },
        { timestamp: 300, mteam: { uploaded: 160, downloaded: 260 } },
        { timestamp: 360, mteam: { uploaded: 160, downloaded: 260 } },
        { timestamp: 420, mteam: { uploaded: 160, downloaded: 260 } },
      ],
    });

    const points = await historyFetcher("/api/panel/history?range=24h");

    expect(points[points.length - 1]).toMatchObject({ 上传: 0, 下载: 0 });
  });

  it("filters share-ratio points before returning the same useful ratios", async () => {
    stubPanelResponse({
      range: "24h",
      current: 3,
      highest: 3,
      lowest: 0,
      data_points: [
        { timestamp: 0, share_ratio: 0 },
        { timestamp: 60, share_ratio: 0.4 },
        { timestamp: 120, share_ratio: 1 },
        { timestamp: 180, share_ratio: 3 },
      ],
    });

    const points = await shareRatioFetcher("/api/panel/share-ratio?range=24h");

    expect(points.map((point) => [point.timestamp, point.分享率])).toEqual([
      [120000, 1],
      [180000, 3],
    ]);
  });
});

describe("SONAR remaining-time filters", () => {
  const unknownRemainingTorrent: Torrent = {
    id: "unknown-remaining",
    name: "Unknown remaining torrent",
    size: 5 * 1024 ** 3,
    size_display: "5 GB",
    seeders: 8,
    leechers: 0,
    discount: "FREE",
    discount_label: "FREE",
    created_date: "2026-06-03",
    detail_url: "https://example.test/torrents/unknown-remaining",
    user_status: "none",
    category: 401,
    mode: "normal",
  };

  const baseFilters = {
    statusFilter: "all",
    search: "",
    sizeFilter: "all",
    seederFilter: "all",
    modeFilter: "all",
  } as const;

  it("keeps unknown remaining times in the all bucket", () => {
    expect(
      matchesSonarFilters(unknownRemainingTorrent, {
        ...baseFilters,
        remainingFilter: "all",
      }),
    ).toBe(true);
  });

  it("excludes unknown remaining times from every concrete bucket", () => {
    const concreteRemainingFilters = [
      "critical",
      "danger",
      "warning",
      "safe",
      "plenty",
    ] as const;

    for (const remainingFilter of concreteRemainingFilters) {
      expect(
        matchesSonarFilters(unknownRemainingTorrent, {
          ...baseFilters,
          remainingFilter,
        }),
      ).toBe(false);
    }
  });
});

describe("PANEL torrent actions", () => {
  it("sends explicit delete_files true and keeps the dialog open when delete fails", async () => {
    vi.mocked(deletePanelTorrents).mockResolvedValue({
      success: false,
      deleted_count: 0,
      failed: ["hash-1"],
      error: "qBittorrent refused delete",
    });
    const mutate = vi.fn() as unknown as KeyedMutator<PanelTorrent[]>;
    const { result } = renderHook(() =>
      usePanelTorrentActions(undefined, mutate),
    );

    act(() => {
      result.current.requestDelete("hash-1", "Ubuntu ISO");
    });

    await act(async () => {
      await result.current.confirmDelete();
    });

    expect(deletePanelTorrents).toHaveBeenCalledWith({
      hashes: ["hash-1"],
      delete_files: true,
    });
    expect(toast.error).toHaveBeenCalledWith("qBittorrent refused delete");
    expect(toast.success).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
    expect(result.current.deleteTarget).toEqual({
      hash: "hash-1",
      name: "Ubuntu ISO",
    });
    expect(result.current.isDeleting).toBe(false);
  });
});
