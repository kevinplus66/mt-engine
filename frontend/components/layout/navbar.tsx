/**
 * Navbar - Neo-Brutalism 全局导航栏
 * 包含 Logo、模块切换、主题切换、移动端抽屉导航
 */

"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun, Settings, Menu, Radar, Radio, Navigation, BarChart3 } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useState } from "react";

export function Navbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const modules = [
    { name: "RADAR", path: "/radar", description: "搜索引擎", icon: Radar },
    { name: "SONAR", path: "/sonar", description: "免费监控", icon: Radio },
    { name: "PILOT", path: "/pilot", description: "自动化", icon: Navigation },
    { name: "PANEL", path: "/panel", description: "数据面板", icon: BarChart3 },
  ];

  const isActive = (path: string) => pathname === path;

  return (
    <header className="border-b-2 border-black bg-white dark:border-white dark:bg-zinc-900">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-red-600 flex items-center justify-center border-2 border-black text-white font-black text-xl dark:border-white">
              M
            </div>
            <div>
              <div className="text-lg font-black tracking-tight uppercase font-mono">
                MT-Engine
              </div>
              <div className="text-[10px] font-mono text-gray-500 tracking-widest uppercase">
                v6.0.0 PREVIEW
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center border-2 border-black dark:border-white">
            {modules.map((module) => (
              <Link
                key={module.path}
                href={module.path}
                className={cn(
                  "px-4 py-2 font-mono text-sm font-bold uppercase tracking-wider border-r-2 border-black last:border-r-0 transition-all dark:border-white",
                  isActive(module.path)
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "bg-white text-black hover:bg-gray-100 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
                )}
              >
                {module.name}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Mobile Menu Button - Most prominent on mobile */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>

            {/* Theme Toggle - Hidden on mobile, shown on desktop */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-10 h-10 hidden md:flex"
              aria-label="Toggle theme"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>

            {/* Settings - Hidden on mobile, shown on desktop */}
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10 hidden md:flex"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
              <span className="sr-only">Settings</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[280px] bg-white dark:bg-zinc-900 p-0">
          <SheetHeader className="border-b-2 border-black dark:border-white p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-600 flex items-center justify-center border-2 border-black text-white font-black text-xl dark:border-white">
                M
              </div>
              <SheetTitle className="text-lg font-black tracking-tight uppercase font-mono">
                MT-Engine
              </SheetTitle>
            </div>
          </SheetHeader>

          {/* Mobile Navigation Links */}
          <nav className="flex flex-col p-2">
            {modules.map((module) => {
              const Icon = module.icon;
              return (
                <Link
                  key={module.path}
                  href={module.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 font-mono text-sm font-bold uppercase tracking-wider transition-all border-2 border-black dark:border-white mb-2",
                    isActive(module.path)
                      ? "bg-red-600 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.8)]"
                      : "bg-white text-black hover:bg-gray-100 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <div className="flex flex-col">
                    <span>{module.name}</span>
                    <span className="text-[10px] font-normal normal-case opacity-70">
                      {module.description}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Mobile Theme Toggle */}
          <div className="p-4 border-t-2 border-black dark:border-white mt-auto">
            <Button
              variant="outline"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-full"
            >
              <Sun className="mr-2 h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute mr-2 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="ml-6">
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
