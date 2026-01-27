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
    <div className="flex flex-wrap gap-3">
      {/* 剩余时间筛选 */}
      <Select value={remainingFilter} onValueChange={onRemainingChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="剩余时间" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">剩余时间</SelectItem>
          <SelectItem value="critical">&lt; 1小时</SelectItem>
          <SelectItem value="danger">1-2小时</SelectItem>
          <SelectItem value="warning">2-6小时</SelectItem>
          <SelectItem value="safe">6-24小时</SelectItem>
          <SelectItem value="plenty">&gt; 24小时</SelectItem>
        </SelectContent>
      </Select>

      {/* 频道筛选 */}
      <Select value={modeFilter} onValueChange={onModeChange}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="频道" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">频道</SelectItem>
          <SelectItem value="normal">综合</SelectItem>
          <SelectItem value="adult">成人</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export type { RemainingFilter, ModeFilter };
