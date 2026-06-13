import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import packageInfo from "@/package.json";
import { AppShell } from "@/components/layout/navbar";
import type { RuntimeHealth } from "@/hooks/use-runtime-status";

let mockHealth: RuntimeHealth | null = "live";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: "light",
    setTheme: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-runtime-status", () => ({
  useRuntimeStatus: () => ({
    data: undefined,
    error: undefined,
    isLoading: false,
    health: mockHealth,
  }),
}));

describe("AppShell", () => {
  beforeEach(() => {
    mockHealth = "live";
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the app version under the logo instead of Coss Console copy", () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );

    expect(screen.getByText(`v${packageInfo.version}`)).toBeTruthy();
    expect(screen.queryByText("Coss Console")).toBeNull();
  });

  it("reflects runtime health in the status badge", () => {
    mockHealth = "offline";
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );

    expect(screen.getByText("offline")).toBeTruthy();
    expect(screen.queryByText("live")).toBeNull();
  });

  it("hides the status badge before the first status response", () => {
    mockHealth = null;
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );

    expect(screen.queryByText("live")).toBeNull();
    expect(screen.queryByText("offline")).toBeNull();
  });

  it("labels the theme toggle with the target mode", () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );

    expect(screen.getByLabelText("切换到深色模式")).toBeTruthy();
  });
});
