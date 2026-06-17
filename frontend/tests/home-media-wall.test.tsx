import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockAnimationFrame, mockMatchMedia, resetMatchMedia } from "./browser-shims";
import { HomeMediaWall } from "@/components/home/media-wall";
import type { MediaWallResponse } from "@/lib/types";

const fixture: MediaWallResponse = {
  last_refreshed: "2026-05-26T12:00:00+08:00",
  next_refresh: "2026-05-26T18:00:00+08:00",
  stale: false,
  refresh_status: "ok",
  last_error: null,
  rails: [
    {
      id: "western_series",
      title: "英美剧更新",
      description: "4K 美剧、英剧和英语剧集更新",
      items: [
        {
          id: "1001",
          media_key: "douban:123",
          title: "Example Show",
          torrent_name: "Example Show S01E05 2026 2160p WEB-DL HEVC Atmos 中字-Team",
          poster_url: "https://img.example/poster.webp",
          detail_url: "https://kp.m-team.cc/detail/1001",
          year: "2026",
          media_type: "series",
          episode: "S01E05",
          quality_tags: ["2160p", "WEB-DL", "H.265", "Atmos", "中字"],
          rail_reason: "英美 4K 剧集更新",
          created_date: "2026-05-26T11:30:00+08:00",
          size: 53687091200,
          size_display: "50.00 GB",
          seeders: 12,
          leechers: 34,
          times_completed: 5,
          discount: "NORMAL",
          douban: "123",
          imdb: "tt123",
          douban_rating: "8.8",
          imdb_rating: "8.2",
          description: "A sample movie.",
        },
        {
          id: "1002",
          media_key: "imdb:tt456",
          title: "No Poster Show",
          torrent_name: "No Poster Show S01E03 2160p WEB-DL HEVC",
          poster_url: null,
          detail_url: "https://kp.m-team.cc/detail/1002",
          year: "2026",
          media_type: "series",
          episode: "S01E03",
          quality_tags: ["2160p", "WEB-DL", "H.265"],
          rail_reason: "英美 4K 剧集更新",
          created_date: "2026-05-26T10:30:00+08:00",
          size: 10737418240,
          size_display: "10.00 GB",
          seeders: 6,
          leechers: 18,
          times_completed: 1,
          discount: "NORMAL",
          douban: null,
          imdb: "tt456",
          douban_rating: null,
          imdb_rating: null,
          description: null,
        },
      ],
    },
    {
      id: "foreign_movies",
      title: "近期外语电影",
      description: "近期 4K 外语电影资源",
      items: [],
    },
    {
      id: "asian_series",
      title: "日韩剧更新",
      description: "4K 韩剧、日剧更新",
      items: [],
    },
    {
      id: "chinese_series",
      title: "华语剧集",
      description: "4K 国产、港台和华语剧集",
      items: [],
    },
    {
      id: "classic_restorations",
      title: "经典补档 / 高质量收藏",
      description: "4K 修复、Remux 和收藏向资源",
      items: [],
    },
  ],
};

const fallbackFixture: MediaWallResponse = {
  ...fixture,
  rails: [
    ...fixture.rails,
    {
      id: "quality_latest",
      title: "最新高质量补位",
      description: "放宽质量条件后的近期优质资源",
      items: [
        {
          id: "2001",
          media_key: "mteam:2001",
          title: "Relaxed Quality Pick",
          torrent_name: "Relaxed Quality Pick 2026 1080p WEB-DL HEVC",
          poster_url: null,
          detail_url: "https://kp.m-team.cc/detail/2001",
          year: "2026",
          media_type: "movie",
          episode: null,
          quality_tags: ["1080p", "WEB-DL", "H.265"],
          rail_reason: "放宽质量条件补位",
          created_date: "2026-05-26T09:30:00+08:00",
          size: 8589934592,
          size_display: "8.00 GB",
          seeders: 8,
          leechers: 2,
          times_completed: 20,
          discount: "NORMAL",
          douban: null,
          imdb: "tt2001",
          douban_rating: null,
          imdb_rating: null,
          description: null,
        },
      ],
    },
    {
      id: "popular_media",
      title: "热门媒体补位",
      description: "热门榜单中的可展示资源",
      items: [],
    },
  ],
};

describe("HomeMediaWall", () => {
  beforeEach(() => {
    mockAnimationFrame();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    resetMatchMedia();
  });

  it("renders media rails and opens a read-only detail sheet from a poster", async () => {
    const user = userEvent.setup();

    render(<HomeMediaWall data={fixture} />);

    expect(screen.getByText("英美剧更新")).toBeTruthy();
    expect(screen.getByText("近期外语电影")).toBeTruthy();
    expect(screen.getByText("日韩剧更新")).toBeTruthy();
    expect(screen.getByText("2160p / WEB-DL")).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: /查看 Example Show 的详情/ }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Example Show")).toBeTruthy();
    expect(within(dialog).getByText("50.00 GB")).toBeTruthy();
    expect(within(dialog).getByRole("link", { name: "打开 M-Team" })).toHaveProperty(
      "href",
      "https://kp.m-team.cc/detail/1001",
    );
    expect(within(dialog).getByRole("link", { name: "在 RADAR 搜索" })).toHaveProperty(
      "href",
      "http://localhost:3000/radar?keyword=Example+Show",
    );
    expect(within(dialog).queryByRole("button", { name: /下载/ })).toBeNull();
    expect(within(dialog).queryByText(/加入 PILOT|收藏|自动下载/)).toBeNull();
  });

  it("uses a slower wide motion preset for desktop media details", async () => {
    mockMatchMedia(false);
    render(<HomeMediaWall data={fixture} />);

    fireEvent.click(
      screen.getByRole("button", { name: /查看 Example Show 的详情/ }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();

    const dialog = await screen.findByRole("dialog");
    expect(dialog.className).toContain("duration-[520ms]");
    expect(dialog.className).toContain("data-ending-style:duration-[360ms]");
    expect(dialog.className).toContain("max-w-2xl");
    expect(dialog.className).toContain("translate-x-[calc(100%+2rem)]");
  });

  it("opens media details as a bottom sheet on mobile", async () => {
    mockMatchMedia(true);
    render(<HomeMediaWall data={fixture} />);

    fireEvent.click(
      screen.getByRole("button", { name: /查看 Example Show 的详情/ }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();

    const dialog = await screen.findByRole("dialog");
    expect(dialog.className).toContain("duration-[450ms]");
    expect(dialog.className).toContain("h-[82vh]");
    expect(dialog.className).toContain("rounded-t-2xl");
    expect(dialog.className).toContain("translate-y-full");
  });

  it("cancels a pending media detail when refreshed rails replace the poster", () => {
    vi.useFakeTimers();
    mockMatchMedia(false);
    mockAnimationFrame();

    const { rerender } = render(<HomeMediaWall data={fixture} />);

    fireEvent.click(
      screen.getByRole("button", { name: /查看 Example Show 的详情/ }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();

    rerender(
      <HomeMediaWall
        data={{
          ...fixture,
          rails: fixture.rails.map((rail) =>
            rail.id === "western_series"
              ? { ...rail, items: [fixture.rails[0]!.items[1]!] }
              : rail,
          ),
        }}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not move poster artwork on hover", () => {
    render(<HomeMediaWall data={fixture} />);

    const poster = screen.getByRole("button", { name: /查看 Example Show 的详情/ });
    const artworkFrame = poster.firstElementChild;

    expect(artworkFrame?.className).not.toContain("translate-y");
  });

  it("still opens a poster after minor pointer movement in the rail", async () => {
    render(<HomeMediaWall data={fixture} />);

    const rail = screen.getByRole("region", { name: "英美剧更新 横向资源列表" });
    Object.defineProperty(rail, "scrollWidth", { configurable: true, value: 1000 });
    Object.defineProperty(rail, "clientWidth", { configurable: true, value: 300 });

    fireEvent.pointerDown(rail, {
      clientX: 100,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.pointerMove(rail, {
      clientX: 108,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.pointerUp(rail, {
      clientX: 108,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.click(screen.getByRole("button", { name: /查看 Example Show 的详情/ }));

    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("renders fallback rails using the same poster/card behavior", () => {
    render(<HomeMediaWall data={fallbackFixture} />);

    expect(screen.getByText("最新高质量补位")).toBeTruthy();
    expect(screen.getByText("热门媒体补位")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /查看 Relaxed Quality Pick 的详情/ }),
    ).toBeTruthy();
    expect(screen.getByText("1080p / WEB-DL")).toBeTruthy();
  });

  it("describes empty rails as a per-group miss, not missing cache", () => {
    render(<HomeMediaWall data={fixture} />);

    expect(screen.getAllByText("当前筛选分组暂无匹配资源").length).toBeGreaterThan(0);
    expect(screen.queryByText("暂无缓存")).toBeNull();
  });

  it("keeps stale-with-items messaging focused on cached content", () => {
    render(
      <HomeMediaWall
        data={{
          ...fixture,
          stale: true,
          refresh_status: "error",
          last_error: "upstream returned no candidates",
        }}
      />,
    );

    expect(screen.getByText(/正在显示已缓存内容/)).toBeTruthy();
    expect(screen.queryByText(/暂未产生可展示资源/)).toBeNull();
    expect(screen.queryByText("暂无缓存")).toBeNull();
  });

  it("renders backend-shaped diagnostics totals in the compact line", () => {
    render(
      <HomeMediaWall
        data={{
          ...fixture,
          diagnostics: {
            sources: {
              latest: 5,
              movies: 3,
            },
            rails: {
              quality_latest: {
                items: 4,
                strict: 0,
                relaxed: 2,
                fallback: 2,
              },
            },
          },
        }}
      />,
    );

    expect(screen.getByText("来源 8 项 · 放宽填充 2 项 · 兜底 2 项")).toBeTruthy();
  });

  it("ignores null and malformed diagnostic entries", () => {
    render(
      <HomeMediaWall
        data={{
          ...fixture,
          diagnostics: {
            sources: {
              latest: 5,
              nullish: null,
              malformed: "not-a-count",
            },
            rails: {
              western_series: {
                items: 1,
                strict: 0,
                relaxed: 1,
                fallback: 0,
              },
              nullish: null,
              malformed: "not-a-rail",
              quality_latest: {
                items: 2,
                strict: 0,
                relaxed: 0,
                fallback: 2,
              },
            },
          } as unknown as MediaWallResponse["diagnostics"],
        }}
      />,
    );

    expect(screen.getByText("来源 5 项 · 放宽填充 1 项 · 兜底 2 项")).toBeTruthy();
  });

  it("continues to render legacy diagnostics count fields", () => {
    render(
      <HomeMediaWall
        data={{
          ...fixture,
          diagnostics: {
            sources: {
              latest: { count: 5 },
              movies: { count: 3 },
              hot: { count: 2 },
            },
            rails: {
              western_series: {
                count: 2,
                strict_count: 1,
                relaxed_count: 1,
                fallback_count: 0,
              },
              quality_latest: {
                count: 4,
                strict_count: 0,
                relaxed_count: 2,
                fallback_count: 2,
              },
            },
          },
        }}
      />,
    );

    expect(screen.getByText("来源 10 项 · 放宽填充 3 项 · 兜底 2 项")).toBeTruthy();
  });
});






