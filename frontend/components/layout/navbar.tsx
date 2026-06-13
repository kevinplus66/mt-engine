"use client";

import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Command,
  Home,
  Menu,
  Moon,
  Navigation,
  Radar,
  Radio,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import packageInfo from "@/package.json";
import { useRuntimeStatus, type RuntimeHealth } from "@/hooks/use-runtime-status";
import { cn } from "@/lib/utils";

const modules = [
  { name: "首页", code: "HOME", path: "/", icon: Home },
  { name: "搜索", code: "RADAR", path: "/radar", icon: Radar },
  { name: "监控", code: "SONAR", path: "/sonar", icon: Radio },
  { name: "自动化", code: "PILOT", path: "/pilot", icon: Navigation },
  { name: "面板", code: "PANEL", path: "/panel", icon: BarChart3 },
] as const;
const appVersion = `v${packageInfo.version}`;

const healthBadges: Record<
  RuntimeHealth,
  { label: string; variant: "success" | "warning" | "error"; description: string }
> = {
  live: { label: "live", variant: "success", description: "后端运行正常" },
  stale: { label: "stale", variant: "warning", description: "后端缓存已过期" },
  offline: { label: "offline", variant: "error", description: "后端连接失败" },
};

function RuntimeStatusBadge() {
  const { health } = useRuntimeStatus();
  if (!health) return null;

  const badge = healthBadges[health];
  return (
    <Badge
      variant={badge.variant}
      className="hidden sm:inline-flex"
      title={badge.description}
      aria-label={badge.description}
    >
      <span translate="no">{badge.label}</span>
    </Badge>
  );
}

function isActivePath(pathname: string, path: string) {
  if (path === "/") return pathname === "/";
  return pathname.startsWith(path);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-1 md:flex-row md:items-center">
      {modules.map((module) => {
        const Icon = module.icon;
        const active = isActivePath(pathname, module.path);

        return (
          <Button
            key={module.path}
            render={
              <Link
                href={module.path}
                aria-current={active ? "page" : undefined}
                onClick={() => setMobileOpen(false)}
              />
            }
            variant={active ? "default" : "ghost"}
            size="sm"
            className={cn(
              "h-9 justify-start px-3 md:h-8",
              active && "shadow-none"
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span translate="no">{module.code}</span>
            <span className="text-xs opacity-64 md:hidden">{module.name}</span>
          </Button>
        );
      })}
    </nav>
  );

  return (
    <div
      data-app-root
      className="min-h-svh bg-[linear-gradient(180deg,var(--background)_0%,color-mix(in_srgb,var(--background),var(--color-neutral-500)_4%)_100%)]"
    >
      <a
        href="#main-content"
        className="pointer-events-none fixed left-[calc(1rem+var(--app-safe-left))] top-[calc(1rem+var(--app-safe-top))] z-[100] -translate-y-24 rounded-md bg-background px-3 py-2 font-medium text-foreground text-sm opacity-0 shadow-lg outline-none ring-offset-background motion-safe:transition-[opacity,transform] motion-reduce:translate-y-0 motion-reduce:transition-none focus:pointer-events-auto focus:translate-y-0 focus:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        跳到主要内容
      </a>
      <header className="sticky top-0 z-40 border-b bg-background/86 pt-[var(--app-safe-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1480px] items-center gap-3 pl-[calc(0.75rem+var(--app-safe-left))] pr-[calc(0.75rem+var(--app-safe-right))] sm:pl-[calc(1rem+var(--app-safe-left))] sm:pr-[calc(1rem+var(--app-safe-right))] lg:pl-[calc(1.5rem+var(--app-safe-left))] lg:pr-[calc(1.5rem+var(--app-safe-right))]">
          <Link
            href="/"
            aria-label={`MT-Engine ${appVersion}`}
            className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 outline-none transition-colors hover:bg-accent hover:text-accent-foreground motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-primary text-primary-foreground shadow-xs">
              <Command className="size-4" aria-hidden="true" />
            </div>
            <div className="hidden min-w-0 sm:block">
              <div
                className="truncate font-heading font-semibold leading-none"
                translate="no"
              >
                MT-Engine
              </div>
              <div className="mt-0.5 text-muted-foreground text-xs">{appVersion}</div>
            </div>
          </Link>

          <div className="hidden flex-1 justify-center md:flex">{nav}</div>

          <div className="ml-auto flex items-center gap-2">
            <RuntimeStatusBadge />
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
              aria-label={
                resolvedTheme === "dark" ? "切换到浅色模式" : "切换到深色模式"
              }
            >
              <Sun
                className="size-4 scale-100 motion-safe:transition-transform motion-reduce:transition-none dark:scale-0"
                aria-hidden="true"
              />
              <Moon
                className="absolute size-4 scale-0 motion-safe:transition-transform motion-reduce:transition-none dark:scale-100"
                aria-hidden="true"
              />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="打开导航"
            >
              <Menu className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="w-[310px] p-0">
          <SheetHeader className="border-b p-4">
            <SheetTitle className="flex items-center gap-2 font-heading">
              <Command className="size-4" aria-hidden="true" />
              <span translate="no">MT-Engine</span>
            </SheetTitle>
          </SheetHeader>
          <div className="p-3">{nav}</div>
        </SheetContent>
      </Sheet>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-[1480px] scroll-mt-[calc(3.5rem+var(--app-safe-top))] pt-4 pl-[calc(0.75rem+var(--app-safe-left))] pr-[calc(0.75rem+var(--app-safe-right))] pb-[calc(1rem+var(--app-safe-bottom))] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:pt-5 sm:pl-[calc(1rem+var(--app-safe-left))] sm:pr-[calc(1rem+var(--app-safe-right))] sm:pb-[calc(1.25rem+var(--app-safe-bottom))] lg:pl-[calc(1.5rem+var(--app-safe-left))] lg:pr-[calc(1.5rem+var(--app-safe-right))]"
      >
        {children}
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  eyebrow,
  description,
  icon: Icon,
  actions,
  meta,
}: {
  title: string;
  eyebrow: string;
  description?: string;
  icon: LucideIcon;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border bg-card shadow-xs/5">
          <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="text-muted-foreground text-xs font-medium">
            {eyebrow}
          </div>
          <h1 className="mt-1 text-balance font-heading font-semibold text-2xl leading-tight sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-muted-foreground text-sm leading-6">
              {description}
            </p>
          )}
          {meta && <div className="mt-3 flex flex-wrap gap-2">{meta}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
