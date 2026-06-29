import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetcher } from "@/lib/api";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
}

function requestHeaders(callIndex = 0) {
  const calls = vi.mocked(fetch).mock.calls;
  const init = calls[callIndex]?.[1] as RequestInit | undefined;
  return new Headers(init?.headers);
}

function setupLocalStorage() {
  const items = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      clear: () => items.clear(),
      getItem: (key: string) => items.get(key) ?? null,
      removeItem: (key: string) => items.delete(key),
      setItem: (key: string, value: string) => items.set(key, value),
    },
  });
}

beforeEach(() => {
  setupLocalStorage();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API key authentication", () => {
  it("sends a stored API key on API requests", async () => {
    window.localStorage.setItem("mt-engine-api-key", "stored-key");
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ status: "ok" }));

    await expect(fetcher("/api/pilot/config")).resolves.toEqual({ status: "ok" });

    expect(requestHeaders().get("X-MT-ENGINE-Key")).toBe("stored-key");
  });

  it("prompts once, stores the key, and retries protected writes", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("fresh-key");
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse(
          { detail: "Invalid or missing API key" },
          { status: 401, statusText: "Unauthorized" }
        )
      )
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }));

    await expect(
      fetcher("/api/pilot/config", { method: "POST", body: "{}" })
    ).resolves.toEqual({ status: "ok" });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(requestHeaders(0).get("X-MT-ENGINE-Key")).toBeNull();
    expect(requestHeaders(1).get("X-MT-ENGINE-Key")).toBe("fresh-key");
    expect(window.localStorage.getItem("mt-engine-api-key")).toBe("fresh-key");
  });
});
