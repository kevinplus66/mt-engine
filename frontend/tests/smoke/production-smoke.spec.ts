import { expect, test, type Page } from "@playwright/test";
import { expectNoSideEffects, installNoSideEffectsGuard } from "./no-side-effects";

type RouteCheck = {
  path: string;
  expectedPath?: string;
  eyebrow: string;
  title: string;
  stableSignals: string[];
};

const ROUTE_CHECKS: RouteCheck[] = [
  {
    path: "/",
    expectedPath: "/panel",
    eyebrow: "PANEL",
    title: "数据面板",
    stableSignals: ["趋势窗口"],
  },
  {
    path: "/radar",
    eyebrow: "RADAR",
    title: "种子搜索",
    stableSignals: ["搜索条件"],
  },
  {
    path: "/sonar",
    eyebrow: "SONAR",
    title: "免费种子监控",
    stableSignals: ["筛选器"],
  },
  {
    path: "/pilot",
    eyebrow: "PILOT",
    title: "自动化配置",
    stableSignals: ["模拟运行", "保存配置"],
  },
  {
    path: "/panel",
    eyebrow: "PANEL",
    title: "数据面板",
    stableSignals: ["趋势窗口"],
  },
];

function pathRegex(path: string) {
  if (path === "/") return /\/(?:[?#].*)?$/;
  return new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/?(?:[?#].*)?$`);
}

async function installReadOnlyFixtures(page: Page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    if (request.method().toUpperCase() !== "GET") {
      await route.fallback();
      return;
    }

    const url = new URL(request.url());
    const path = url.pathname;

    const fixtures: Record<string, unknown> = {
      "/api/pilot/config": {
        download: {
          enabled: true,
          max_active_tasks: 20,
          interval_seconds: 300,
          save_path: "/downloads/mt_free_farm",
          disk_usage_threshold: 90,
          rules: {
            min_size_gb: 20,
            max_size_gb: 500,
            discount_types: ["FREE", "_2X_FREE"],
            include_keywords: [],
            exclude_keywords: ["AUDIOBOOK"],
            max_seeders: 10,
            min_leechers: 100,
            weight_size: -1,
            weight_free_time: 2,
            weight_age: 0.5,
            weight_seeders: 1,
          },
        },
        cleanup: {
          enabled: true,
          min_share_ratio: 0,
          min_seed_time_hours: 1,
          max_download_time_hours: 12,
          dead_seed_minutes: 30,
          dead_seed_max_ratio: 0.01,
          min_current_users: 5,
          min_upload_speed_kbps: 200,
          elimination_ratio: 0,
        },
        enable_notification: true,
      },
      "/api/pilot/stats": {
        total_downloads: 0,
        total_cleanups: 0,
        active_tasks: 0,
        pending_downloads: 0,
        is_running: true,
        disk_usage_percent: 42,
      },
      "/api/filter-options": {
        categories: [],
        standards: [],
        videoCodecs: [],
        audioCodecs: [],
        sources: [],
        countries: [],
      },
      "/api/torrents": {
        torrents: [],
        total: 0,
      },
      "/api/auto-delete/status": {
        enabled: false,
      },
      "/api/panel/stats": {
        mteam: {
          uploaded: 1,
          downloaded: 1,
          uploaded_display: "1 B",
          downloaded_display: "1 B",
        },
        qbittorrent: {
          uploaded: 1,
          downloaded: 1,
          uploaded_display: "1 B",
          downloaded_display: "1 B",
          upload_speed: 0,
          download_speed: 0,
        },
        user: {
          share_ratio: 1,
          uploaded: 1,
          downloaded: 1,
          seeding_count: 1,
          leeching_count: 0,
        },
        storage: null,
        avg_speeds: {
          upload_30min: 0,
          download_30min: 0,
          upload_display: "0 B/s",
          download_display: "0 B/s",
        },
        last_update: 1,
      },
      "/api/panel/torrents": {
        torrents: [
          {
            id: "fixture",
            hash: "fixture",
            name: "Fixture Torrent",
            status: "uploading",
            progress: 1,
            size: 1024,
            size_display: "1 KB",
            seeders: 1,
            leechers: 0,
            tags: ["PILOT"],
          },
        ],
        total_count: 1,
        filtered_count: 1,
      },
    };

    if (path === "/api/panel/history" || path === "/api/panel/share-ratio") {
      await route.fulfill({
        json: {
          range: url.searchParams.get("range") ?? "24h",
          aggregation: "minute",
          data_points: [],
        },
      });
      return;
    }

    if (path in fixtures) {
      await route.fulfill({ json: fixtures[path] });
      return;
    }

    await route.fallback();
  });
}

test.describe("Production smoke (no side effects)", () => {
  for (const route of ROUTE_CHECKS) {
    test(`${route.path} renders core Coss UI without side effects`, async ({
      page,
    }) => {
      await installReadOnlyFixtures(page);
      const guard = await installNoSideEffectsGuard(page);

      await page.goto(route.path, { waitUntil: "domcontentloaded" });

      await expect(page).toHaveURL(pathRegex(route.expectedPath ?? route.path));
      await expect(page).toHaveTitle(/MT-Engine/i);
      await expect(page.locator("[data-app-root]")).toBeVisible();
      await expect(page.getByRole("link", { name: /MT-Engine/i }).first()).toBeVisible();

      const main = page.locator("#main-content");
      await expect(main.getByRole("heading", { level: 1, name: route.title })).toBeVisible();
      await expect(main.getByText(route.eyebrow, { exact: true }).first()).toBeVisible();

      for (const signal of route.stableSignals) {
        await expect(main.getByText(signal, { exact: true }).first()).toBeVisible();
      }

      await page.waitForTimeout(500);
      expectNoSideEffects(guard.violations);
    });
  }

  test("sonar normalizes legacy pageSize=100 links", async ({ page }) => {
    await installReadOnlyFixtures(page);
    const guard = await installNoSideEffectsGuard(page);

    await page.goto("/sonar?status=none&pageSize=100&smoke=1", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByRole("heading", { level: 1, name: "免费种子监控" })).toBeVisible();
    await expect(page.locator("#main-content").getByText("每页 50", { exact: true })).toBeVisible();
    await expect(page).not.toHaveURL(/pageSize=100/);
    expectNoSideEffects(guard.violations);
  });

  test("panel restores range and monitor status from URL", async ({ page }) => {
    await installReadOnlyFixtures(page);
    const guard = await installNoSideEffectsGuard(page);

    await page.goto("/panel?range=7d&monitorStatus=seeding&smoke=1", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByRole("heading", { level: 1, name: "数据面板" })).toBeVisible();
    await expect(
      page
        .getByRole("group", { name: "趋势时间范围" })
        .getByRole("button", { name: "7 天" })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page
        .getByRole("group", { name: "种子状态筛选" })
        .getByRole("button", { name: "做种中" })
    ).toHaveAttribute("aria-pressed", "true");
    expectNoSideEffects(guard.violations);
  });
});
