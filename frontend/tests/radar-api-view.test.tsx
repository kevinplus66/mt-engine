import {
  cleanup,
  fireEvent,
  render,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RadarPage from "@/app/radar/page";
import { downloadSonarTorrent, downloadTorrent, fetcher } from "@/lib/api";
import { SearchResetBar } from "@/components/common/search-reset-bar";
import {
  buildRadarSearchRequest,
  type RadarQueryState,
} from "@/lib/radar-view";

beforeEach(() => {
  cleanup();
});

afterEach(() => {
  cleanup();
});

const radarQueryStateMock = vi.hoisted(() => ({
  keyword: "",
  mode: "normal" as const,
  selectedCategories: [] as number[],
  filters: {
    standards: [] as number[],
    videoCodecs: [] as number[],
    audioCodecs: [] as number[],
    sources: [] as number[],
    countries: [] as number[],
    discount: "",
  },
  sortField: "time" as const,
  sortDirection: "desc" as const,
  currentState: null as unknown as RadarQueryState,
  handleKeywordChange: vi.fn(),
  handleModeChange: vi.fn(),
  handleCategoriesChange: vi.fn(),
  handleFiltersChange: vi.fn(),
  setSort: vi.fn(),
  resetQueryState: vi.fn(),
}));

const radarSearchMock = vi.hoisted(() => ({
  trigger: vi.fn(),
  data: null as unknown,
  isMutating: false,
  error: null as Error | null,
  reset: vi.fn(),
}));

vi.mock("next/dynamic", () => ({
  default: (
    loader: () => Promise<unknown>,
    options?: { loading?: () => ReactNode },
  ) => {
    if (String(loader).includes("torrent-table")) {
      function TorrentTableMock({
        onSort,
      }: {
        onSort: (field: string) => void;
      }) {
        return (
          <button type="button" onClick={() => onSort("name")}>
            sort name
          </button>
        );
      }
      return TorrentTableMock;
    }

    function DynamicFallbackMock() {
      return options?.loading ? options.loading() : null;
    }
    return DynamicFallbackMock;
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/hooks/use-radar-query-state", () => ({
  useRadarQueryState: () => radarQueryStateMock,
}));

vi.mock("@/hooks/use-radar-search", () => ({
  useRadarSearch: () => radarSearchMock,
}));

vi.mock("@/components/common/page-scaffold", () => ({
  PageScaffold: ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  ),
}));

vi.mock("@/components/common/section-card", () => ({
  SectionCard: ({ children }: { children: ReactNode }) => (
    <section>{children}</section>
  ),
}));

vi.mock("@/components/common/state-card", () => ({
  StateCard: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  AlertTitle: ({ children }: { children: ReactNode }) => (
    <strong>{children}</strong>
  ),
}));

vi.mock("@/components/radar/torrent-table", () => ({
  TorrentTable: ({ onSort }: { onSort: (field: string) => void }) => (
    <button type="button" onClick={() => onSort("name")}>
      sort name
    </button>
  ),
}));

vi.mock("@/components/radar/category-pills", () => ({
  CategoryPills: () => null,
}));

vi.mock("@/components/radar/filter-selects", () => ({
  FilterSelects: () => null,
}));

const failedDownloadCases: Array<
  [string, (request: { id: string }) => Promise<unknown>, string]
> = [
  ["RADAR", downloadTorrent, "/api/radar/download"],
  ["SONAR", downloadSonarTorrent, "/api/download"],
];

describe("RADAR API errors", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(failedDownloadCases)(
    "throws when a %s HTTP-200 download body reports failure",
    async (_label, download, path) => {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({ success: false, message: "already downloading" }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );

      await expect(download({ id: "torrent-1" })).rejects.toThrow(
        "already downloading",
      );
      expect(fetchMock.mock.calls[0]?.[0]).toBe(path);
    },
  );

  it("renders FastAPI detail-array validation errors as messages", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: [
            { loc: ["body", "id"], msg: "Field required", type: "missing" },
            { loc: ["body", "savePath"], msg: "Invalid path" },
          ],
        }),
        {
          status: 422,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    await fetcher("/api/example").then(
      () => {
        throw new Error("expected validation failure");
      },
      (error: Error) => {
        expect(error.message).toBe("Field required; Invalid path");
        expect(error.message).not.toContain("[object Object]");
      },
    );
  });
});

describe("RADAR view sanitization", () => {
  it("drops filters and categories hidden by the active mode while preserving visible filters and sort", () => {
    const request = buildRadarSearchRequest({
      keyword: "movie",
      mode: "adult",
      selectedCategories: [410, 439, 424],
      filters: {
        standards: [6],
        videoCodecs: [16],
        audioCodecs: [10],
        sources: [3],
        countries: [5],
        discount: "FREE",
      },
      sortField: "seeders",
      sortDirection: "asc",
    });

    expect(request.categories).toEqual([410, 424]);
    expect(request.standards).toEqual([6]);
    expect(request.videoCodecs).toEqual([]);
    expect(request.audioCodecs).toEqual([]);
    expect(request.sources).toEqual([]);
    expect(request.countries).toEqual([]);
    expect(request.discount).toBe("FREE");
    expect(request.sortField).toBe("SEEDERS");
    expect(request.sortDirection).toBe("ASC");
  });
});

describe("RADAR stale results", () => {
  beforeEach(() => {
    radarSearchMock.data = {
      success: true,
      data: [
        {
          id: "stale-result",
          name: "Stale Result",
        },
      ],
      total: 1,
      pageNumber: 1,
      pageSize: 50,
    };
    radarSearchMock.error = new Error("backend unavailable");
    radarSearchMock.isMutating = false;
    radarQueryStateMock.currentState = {
      keyword: "linux",
      mode: "normal",
      selectedCategories: [],
      filters: {
        standards: [],
        videoCodecs: [],
        audioCodecs: [],
        sources: [],
        countries: [],
        discount: "",
      },
      sortField: "time",
      sortDirection: "desc",
    };
    radarSearchMock.trigger.mockClear();
    radarSearchMock.trigger.mockResolvedValue(undefined);
    radarSearchMock.reset.mockClear();
  });

  it("hides previous rows when the current search failed", () => {
    const { container } = render(<RadarPage />);
    const view = within(container);

    expect(view.getByText("搜索失败")).toBeTruthy();
    expect(view.queryByRole("button", { name: "sort name" })).toBeNull();
  });

  it("clears previous mutation data before a new search", () => {
    radarSearchMock.error = null;
    const { container } = render(<RadarPage />);

    fireEvent.click(within(container).getByRole("button", { name: "搜索" }));

    expect(radarSearchMock.reset).toHaveBeenCalledTimes(1);
    expect(radarSearchMock.trigger).toHaveBeenCalledTimes(1);
    expect(radarSearchMock.reset.mock.invocationCallOrder[0]).toBeLessThan(
      radarSearchMock.trigger.mock.invocationCallOrder[0],
    );
  });
});

describe("RADAR reset", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    radarQueryStateMock.currentState = {
      keyword: "linux",
      mode: "movie",
      selectedCategories: [],
      filters: {
        standards: [],
        videoCodecs: [],
        audioCodecs: [],
        sources: [],
        countries: [],
        discount: "",
      },
      sortField: "time",
      sortDirection: "desc",
    };
    radarQueryStateMock.sortField = "time";
    radarQueryStateMock.sortDirection = "desc";
    radarQueryStateMock.resetQueryState.mockClear();
    radarQueryStateMock.setSort.mockClear();
    radarSearchMock.trigger.mockClear();
    radarSearchMock.trigger.mockResolvedValue(undefined);
    radarSearchMock.reset.mockClear();
    radarSearchMock.data = {
      success: true,
      data: [],
      total: 0,
      pageNumber: 1,
      pageSize: 50,
    };
    radarSearchMock.error = null;
    radarSearchMock.isMutating = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears mutation data and cancels pending debounced searches", () => {
    const { container } = render(<RadarPage />);
    const view = within(container);

    fireEvent.click(view.getByRole("button", { name: "sort name" }));
    expect(radarQueryStateMock.setSort).toHaveBeenCalledWith("name", "desc");
    fireEvent.click(view.getByRole("button", { name: "重置" }));
    vi.advanceTimersByTime(300);

    expect(radarSearchMock.reset).toHaveBeenCalledTimes(1);
    expect(radarQueryStateMock.resetQueryState).toHaveBeenCalledTimes(1);
    expect(radarSearchMock.trigger).not.toHaveBeenCalled();
  });
});

describe("SearchResetBar IME handling", () => {
  it("does not search on Enter while composition is active", () => {
    const onSearch = vi.fn();
    const { container } = render(
      <SearchResetBar
        value="拼"
        onValueChange={vi.fn()}
        onReset={vi.fn()}
        onSearch={onSearch}
      />,
    );

    const input = within(container).getByRole("textbox", { name: "搜索" });
    const composingEnter = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
    });
    Object.defineProperty(composingEnter, "isComposing", { value: true });

    fireEvent(input, composingEnter);
    expect(onSearch).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSearch).toHaveBeenCalledTimes(1);
  });
});
