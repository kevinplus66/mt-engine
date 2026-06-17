/**
 * FilterPills - SONAR 快速过滤按钮组
 * 包含大小和做种数的快速筛选
 */

"use client";

import { SegmentedControl } from "@/components/common/segmented-control";

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
    { value: "rare" as const, label: "1-4" },
    { value: "dead" as const, label: "0" },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <SegmentedControl
        ariaLabel="按体积筛选"
        value={sizeFilter}
        options={sizeOptions.map((option) => ({
          ...option,
          className: option.value !== "all" ? "min-w-16 tabular-nums" : undefined,
        }))}
        onValueChange={onSizeChange}
      />

      <SegmentedControl
        ariaLabel="按做种数筛选"
        value={seederFilter}
        options={seederOptions.map((option) => ({
          ...option,
          className: option.value !== "all" ? "min-w-12 tabular-nums" : undefined,
        }))}
        onValueChange={onSeederChange}
      />
    </div>
  );
}

export type { SizeFilter, SeederFilter };
