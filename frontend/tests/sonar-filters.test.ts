import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SonarPage from "@/app/sonar/page";
import { matchesSonarFilters } from "../hooks/use-sonar-torrent-view";
import { useSonarQueryState } from "../hooks/use-sonar-query-state";
import { torrentsFetcher } from "../hooks/use-sonar-torrents";
import { createElement, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { Torrent } from "../lib/types";

const sonarNavigationMock = vi.hoisted(() => ({
  queryString: "",
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: sonarNavigationMock.replace }),
  useSearchParams: () => new URLSearchParams(sonarNavigationMock.queryString),
}));

const sonarPageMocks = vi.hoisted(() => ({
  toastError: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({
  toast: {
    error: sonarPageMocks.toastError,
    success: vi.fn(),
  },
}));

vi.mock("@/components/common/page-scaffold", async () => {
  const { createElement } =
    await vi.importActual<typeof import("react")>("react");

  return {
    PageScaffold: ({
      actions,
      children,
    }: {
      actions?: ReactNode;
      children: ReactNode;
    }) => createElement("main", null, actions, children),
  };
});

vi.mock("@/components/ui/button", async () => {
  const { createElement } =
    await vi.importActual<typeof import("react")>("react");

  return {
    Button: ({
      children,
      loading,
      ...props
    }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) =>
      createElement(
        "button",
        {
          "data-loading": loading ? "true" : undefined,
          ...props,
        },
        children,
      ),
  };
});

vi.mock("@/components/sonar/sonar-filter-panel", async () => {
  const { createElement } =
    await vi.importActual<typeof import("react")>("react");

  return {
    SonarFilterPanel: () => createElement("section", { "aria-label": "filters" }),
  };
});

vi.mock("@/components/sonar/torrent-list", async () => {
  const { createElement } =
    await vi.importActual<typeof import("react")>("react");

  return {
    TorrentList: () => createElement("section", { "aria-label": "torrents" }),
  };
});

vi.mock("@/components/common/simple-pagination", async () => {
  const { createElement } =
    await vi.importActual<typeof import("react")>("react");

  return {
    SimplePagination: () => createElement("nav", { "aria-label": "pagination" }),
  };
});

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

describe("SONAR query state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sonarNavigationMock.queryString = "q=alpha";
    sonarNavigationMock.replace.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("keeps local q typing before the debounced URL update", () => {
    const { result } = renderHook(() => useSonarQueryState());

    act(() => {
      result.current.setSearchValue("alphabet");
    });

    expect(result.current.searchValue).toBe("alphabet");
    expect(sonarNavigationMock.replace).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(299);
    });

    expect(result.current.searchValue).toBe("alphabet");
    expect(sonarNavigationMock.replace).not.toHaveBeenCalled();
  });

  it("keeps local q when unrelated URL params change before debounce", () => {
    const { result, rerender } = renderHook(() => useSonarQueryState());

    act(() => {
      result.current.setSearchValue("alphabet");
    });
    act(() => {
      sonarNavigationMock.queryString = "q=alpha&status=seeding";
      rerender();
    });

    expect(result.current.searchValue).toBe("alphabet");
    expect(sonarNavigationMock.replace).not.toHaveBeenCalled();
  });

  it("still syncs q when the URL value changes", () => {
    const { result, rerender } = renderHook(() => useSonarQueryState());

    act(() => {
      sonarNavigationMock.queryString = "q=beta";
      rerender();
    });

    expect(result.current.searchValue).toBe("beta");
    expect(sonarNavigationMock.replace).not.toHaveBeenCalled();
  });

  it("drops pending local q when the URL value changes", () => {
    const { result, rerender } = renderHook(() => useSonarQueryState());

    act(() => {
      result.current.setSearchValue("alphabet");
    });
    act(() => {
      sonarNavigationMock.queryString = "q=beta";
      rerender();
    });

    expect(result.current.searchValue).toBe("beta");
    expect(sonarNavigationMock.replace).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.searchValue).toBe("beta");
    expect(sonarNavigationMock.replace).not.toHaveBeenCalled();
  });
});

describe("SONAR manual refresh", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    sonarPageMocks.toastError.mockClear();
  });

  it("revalidates torrents after a refresh rejection", async () => {
    const torrentResponses = [
      new Response(
        JSON.stringify({
          torrents: [baseTorrent],
          error: null,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
      new Response(
        JSON.stringify({
          torrents: [baseTorrent],
          error: "stale cache after failed refresh",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    ];
    const getFetchUrl = (input: Parameters<typeof fetch>[0]) =>
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = getFetchUrl(input);

        if (url.endsWith("/api/torrents")) {
          const response = torrentResponses.shift();
          if (!response) throw new Error("Unexpected extra torrent fetch");
          return response;
        }

        if (url.endsWith("/api/refresh")) {
          return new Response(JSON.stringify({ detail: "backend backoff" }), {
            status: 502,
            headers: { "content-type": "application/json" },
          });
        }

        throw new Error(`Unexpected fetch: ${url}`);
      });

    render(
      createElement(
        SWRConfig,
        { value: { provider: () => new Map(), dedupingInterval: 0 } },
        createElement(SonarPage),
      ),
    );

    const refreshButton = await screen.findByRole("button", {
      name: /手动刷新/,
    });
    await waitFor(() => {
      expect((refreshButton as HTMLButtonElement).disabled).toBe(false);
    });

    await userEvent.click(refreshButton);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(([input]) => {
          const url = getFetchUrl(input);
          return url.endsWith("/api/torrents");
        }),
      ).toHaveLength(2);
    });
    expect(sonarPageMocks.toastError).toHaveBeenCalledOnce();
    expect(screen.getByText(/stale cache after failed refresh/)).toBeTruthy();
    expect((refreshButton as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("SONAR torrents fetcher", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("surfaces backend cache errors instead of returning stale torrents", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          torrents: [baseTorrent],
          error: "M-Team cache refresh failed",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    await expect(torrentsFetcher("/api/torrents")).rejects.toThrow(
      "M-Team cache refresh failed",
    );
  });

  it("surfaces backend refresh backoff as stale cache failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          torrents: [baseTorrent],
          error: null,
          free_refresh_backoff_reason: "FREE refresh cooldown active",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    await expect(torrentsFetcher("/api/torrents")).rejects.toThrow(
      "FREE refresh cooldown active",
    );
  });
});
