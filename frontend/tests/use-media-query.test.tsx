import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useIsMobile } from "@/hooks/use-media-query";
import { mockMatchMedia, resetMatchMedia } from "./browser-shims";

function HookResult() {
  return <output aria-label="is mobile">{String(useIsMobile())}</output>;
}

function expectIsMobile(value: boolean) {
  expect(screen.getByLabelText("is mobile").textContent).toBe(String(value));
}

function mockChangingMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<() => void>();

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) =>
      ({
        get matches() {
          return matches;
        },
        media: query,
        onchange: null,
        addEventListener: (...args: unknown[]) => {
          const [type, listener] = args;
          if (type === "change" && typeof listener === "function") {
            listeners.add(listener as () => void);
          }
        },
        removeEventListener: (...args: unknown[]) => {
          const [type, listener] = args;
          if (type === "change" && typeof listener === "function") {
            listeners.delete(listener as () => void);
          }
        },
        addListener: (listener: () => void) => {
          listeners.add(listener);
        },
        removeListener: (listener: () => void) => {
          listeners.delete(listener);
        },
        dispatchEvent: () => false,
      }) as MediaQueryList,
  });

  return (nextMatches: boolean) => {
    matches = nextMatches;
    listeners.forEach((listener) => listener());
  };
}

describe("useIsMobile", () => {
  afterEach(() => {
    cleanup();
    resetMatchMedia();
  });

  it("returns false for the desktop fallback when matchMedia is absent", () => {
    resetMatchMedia();

    render(<HookResult />);

    expectIsMobile(false);
  });

  it("returns false for non-matching desktop media", () => {
    mockMatchMedia(false);

    render(<HookResult />);

    expectIsMobile(false);
  });

  it("returns true for matching mobile media", () => {
    mockMatchMedia(true);

    render(<HookResult />);

    expectIsMobile(true);
  });

  it("uses the fixed mobile breakpoint media query", () => {
    const queries: string[] = [];
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => {
        queries.push(query);
        return {
          matches: false,
          media: query,
          onchange: null,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          addListener: () => undefined,
          removeListener: () => undefined,
          dispatchEvent: () => false,
        } as MediaQueryList;
      },
    });

    render(<HookResult />);

    expect(queries.length).toBeGreaterThan(0);
    expect(queries.every((query) => query === "(max-width: 767px)")).toBe(true);
  });

  it("updates when the media query changes", () => {
    const setMediaQueryMatches = mockChangingMatchMedia(false);

    render(<HookResult />);
    expectIsMobile(false);

    act(() => {
      setMediaQueryMatches(true);
    });
    expectIsMobile(true);

    act(() => {
      setMediaQueryMatches(false);
    });
    expectIsMobile(false);
  });
});
