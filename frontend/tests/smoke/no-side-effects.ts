import { expect, type Page } from "@playwright/test";

type BlockRule = {
  label: string;
  pathname: RegExp;
  methods: Set<string>;
};

export type SideEffectViolation = {
  label: string;
  method: string;
  url: string;
};

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const BLOCK_RULES: BlockRule[] = [
  {
    label: "RADAR download",
    pathname: /\/api\/radar\/download$/i,
    methods: MUTATING_METHODS,
  },
  {
    label: "SONAR download",
    pathname: /\/api\/download$/i,
    methods: MUTATING_METHODS,
  },
  {
    label: "PILOT save config",
    pathname: /\/api\/pilot\/config$/i,
    methods: new Set(["POST", "PUT", "PATCH"]),
  },
  {
    label: "PILOT run download",
    pathname: /\/api\/pilot\/run-download$/i,
    methods: MUTATING_METHODS,
  },
  {
    label: "PILOT run cleanup",
    pathname: /\/api\/pilot\/run-cleanup$/i,
    methods: MUTATING_METHODS,
  },
  {
    label: "PANEL pause torrents",
    pathname: /\/api\/panel\/torrents\/pause$/i,
    methods: MUTATING_METHODS,
  },
  {
    label: "PANEL resume torrents",
    pathname: /\/api\/panel\/torrents\/resume$/i,
    methods: MUTATING_METHODS,
  },
  {
    label: "PANEL delete torrents",
    pathname: /\/api\/panel\/torrents\/delete$/i,
    methods: MUTATING_METHODS,
  },
  {
    label: "SONAR auto-delete toggle",
    pathname: /\/api\/auto-delete\/toggle$/i,
    methods: MUTATING_METHODS,
  },
];

function getPathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function getBlockedRule(method: string, pathname: string): BlockRule | null {
  for (const rule of BLOCK_RULES) {
    if (rule.pathname.test(pathname) && rule.methods.has(method)) {
      return rule;
    }
  }
  return null;
}

export async function installNoSideEffectsGuard(page: Page) {
  const violations: SideEffectViolation[] = [];

  await page.route("**/*", async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = request.url();
    const pathname = getPathname(url);
    const blockedRule = getBlockedRule(method, pathname);

    if (!blockedRule) {
      await route.fallback();
      return;
    }

    violations.push({
      label: blockedRule.label,
      method,
      url,
    });
    await route.abort("blockedbyclient");
  });

  return {
    violations,
  };
}

export function expectNoSideEffects(violations: SideEffectViolation[]) {
  const violationSummary = violations
    .map((violation) => `${violation.method} ${violation.url} (${violation.label})`)
    .join("\n");

  expect(
    violations,
    violationSummary
      ? `Blocked side-effect request(s) detected:\n${violationSummary}`
      : "No side-effect requests should be sent during smoke tests."
  ).toEqual([]);
}
