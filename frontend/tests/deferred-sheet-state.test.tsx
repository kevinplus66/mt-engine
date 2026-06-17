import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockAnimationFrame, mockMatchMedia, resetMatchMedia } from "./browser-shims";
import { TorrentTable } from "@/components/radar/torrent-table";
import { TorrentList } from "@/components/sonar/torrent-list";
import type { Torrent } from "@/lib/types";

const torrent: Torrent = {
  id: "torrent-1",
  name: "Example Torrent",
  small_descr: "Example description",
  size: 1_073_741_824,
  size_display: "1.00 GB",
  seeders: 12,
  leechers: 3,
  discount: "FREE",
  discount_label: "免费",
  created_date: "2026-06-10T12:00:00+08:00",
  detail_url: "https://kp.m-team.cc/detail/torrent-1",
  user_status: "none",
  category: 401,
};

const replacementTorrent: Torrent = {
  ...torrent,
  id: "torrent-2",
  name: "Replacement Torrent",
  detail_url: "https://kp.m-team.cc/detail/torrent-2",
};

describe("deferred sheet state", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    resetMatchMedia();
  });

  it("cancels a pending RADAR detail open when results become empty", () => {
    vi.useFakeTimers();
    mockMatchMedia(false);
    mockAnimationFrame();

    const { rerender } = render(<TorrentTable torrents={[torrent]} total={1} />);

    fireEvent.click(
      screen.getByRole("button", { name: /查看种子详情：Example Torrent/ }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();

    rerender(<TorrentTable torrents={[]} total={0} />);
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(screen.queryByRole("dialog")).toBeNull();

    rerender(<TorrentTable torrents={[torrent]} total={1} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("cancels a pending RADAR detail open when results are replaced", () => {
    vi.useFakeTimers();
    mockMatchMedia(false);
    mockAnimationFrame();

    const { rerender } = render(<TorrentTable torrents={[torrent]} total={1} />);

    fireEvent.click(
      screen.getByRole("button", { name: /查看种子详情：Example Torrent/ }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();

    rerender(<TorrentTable torrents={[replacementTorrent]} total={1} />);
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByRole("button", { name: /查看种子详情：Replacement Torrent/ }),
    ).toBeTruthy();
  });

  it("resets SONAR detail state when selected torrent moves outside rendered window", () => {
    vi.useFakeTimers();
    mockMatchMedia(false);
    mockAnimationFrame();
    const sonarTorrents = Array.from({ length: 51 }, (_, index) => ({
      ...torrent,
      id: `sonar-${index}`,
      name: `Sonar Torrent ${index}`,
      detail_url: `https://kp.m-team.cc/detail/sonar-${index}`,
    }));

    const { rerender } = render(
      <TorrentList torrents={sonarTorrents} totalCount={sonarTorrents.length} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /查看种子详情：Sonar Torrent 0/ }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();

    rerender(
      <TorrentList
        torrents={[...sonarTorrents.slice(1), sonarTorrents[0]!]}
        totalCount={sonarTorrents.length}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
