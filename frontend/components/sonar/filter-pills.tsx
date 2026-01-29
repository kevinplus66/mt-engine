/**
 * FilterPills - SONAR 快速过滤按钮组
 * 包含大小和做种数的快速筛选
 */

"use client";

import { cn } from "@/lib/utils";

type SizeFilter = "all" | "small" | "medium" | "large" | "xlarge";
type SeederFilter = "all" | "hot" | "normal" | "rare" | "dead";

interface FilterPillsProps {
  sizeFilter: SizeFilter;
  seederFilter: SeederFilter;
  onSizeChange: (filter: SizeFilter) => void;
  onSeederChange: (filter: SeederFilter) => void;
}

export function FilterPills({
  sizeFilter,
  seederFilter,
  onSizeChange,
  onSeederChange,
}: FilterPillsProps) {
  const sizeOptions = [
    { value: "all" as const, label: "全部" },
    { value: "small" as const, label: "<10GB" },
    { value: "medium" as const, label: "10-50GB" },
    { value: "large" as const, label: "50-100GB" },
    { value: "xlarge" as const, label: ">100GB" },
  ];

  const seederOptions = [
    { value: "all" as const, label: "全部" },
    { value: "hot" as const, label: ">10" },
    { value: "normal" as const, label: "5-10" },
    { value: "rare" as const, label: "1-5" },
    { value: "dead" as const, label: "0" },
  ];

  return (
    <div className="space-y-3">
      {/* 大小过滤 */}
      <div className="flex flex-wrap gap-2">
        {sizeOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onSizeChange(option.value)}
            aria-pressed={sizeFilter === option.value}
            className={cn(
              "px-3 py-1 text-xs font-mono border-2 border-black transition-all",
              "hover:translate-y-[-1px] active:translate-y-0",
              "focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.8)]",
              "dark:border-white",
              sizeFilter === option.value
                ? "bg-black text-white dark:bg-white dark:text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.8)]"
                : "bg-white text-black dark:bg-zinc-900 dark:text-white"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* 做种数过滤 */}
      <div className="flex flex-wrap gap-2">
        {seederOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onSeederChange(option.value)}
            aria-pressed={seederFilter === option.value}
            className={cn(
              "px-3 py-1 text-xs font-mono border-2 border-black transition-all",
              "hover:translate-y-[-1px] active:translate-y-0",
              "focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.8)]",
              "dark:border-white",
              seederFilter === option.value
                ? "bg-black text-white dark:bg-white dark:text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.8)]"
                : "bg-white text-black dark:bg-zinc-900 dark:text-white"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export type { SizeFilter, SeederFilter };
