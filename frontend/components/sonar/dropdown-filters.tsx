/**
 * DropdownFilters - SONAR 下拉过滤器
 * 包含剩余时间和频道筛选
 */

"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RemainingFilter = "all" | "critical" | "danger" | "warning" | "safe" | "plenty";
type ModeFilter = "all" | "normal" | "adult";

const remainingOptions = [
  { value: "all" as const, label: "全部剩余时间" },
  { value: "critical" as const, label: "< 1小时" },
  { value: "danger" as const, label: "1-2小时" },
  { value: "warning" as const, label: "2-6小时" },
  { value: "safe" as const, label: "6-24小时" },
  { value: "plenty" as const, label: "> 24小时" },
];

const modeOptions = [
  { value: "all" as const, label: "全部频道" },
  { value: "normal" as const, label: "综合" },
  { value: "adult" as const, label: "成人" },
];

interface DropdownFiltersProps {
  remainingFilter: RemainingFilter;
  modeFilter: ModeFilter;
  onRemainingChange: (filter: RemainingFilter) => void;
  onModeChange: (filter: ModeFilter) => void;
}

export function DropdownFilters({
  remainingFilter,
  modeFilter,
  onRemainingChange,
  onModeChange,
}: DropdownFiltersProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {/* 剩余时间筛选 */}
      <Select
        items={remainingOptions}
        value={remainingFilter}
        onValueChange={(value) => {
          if (value) onRemainingChange(value as RemainingFilter);
        }}
      >
        <SelectTrigger className="w-full" aria-label="剩余时间筛选">
          <SelectValue placeholder="剩余时间" />
        </SelectTrigger>
        <SelectContent>
          {remainingOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 频道筛选 */}
      <Select
        items={modeOptions}
        value={modeFilter}
        onValueChange={(value) => {
          if (value) onModeChange(value as ModeFilter);
        }}
      >
        <SelectTrigger className="w-full" aria-label="频道筛选">
          <SelectValue placeholder="频道" />
        </SelectTrigger>
        <SelectContent>
          {modeOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export type { RemainingFilter, ModeFilter };
