"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchResetBar } from "@/components/common/search-reset-bar";
import { SegmentedControl } from "@/components/common/segmented-control";
import { SectionCard } from "@/components/common/section-card";
import {
  DropdownFilters,
  type ModeFilter,
  type RemainingFilter,
} from "@/components/sonar/dropdown-filters";
import {
  FilterPills,
  type SeederFilter,
  type SizeFilter,
} from "@/components/sonar/filter-pills";
import {
  sonarDensityOptions,
  sonarPageSizeOptions,
  type Density,
  type UserStatus,
} from "@/lib/sonar-view";

const sonarStatusOptions = [
  { value: "all" as const, label: "全部" },
  { value: "seeding" as const, label: "做种中" },
  { value: "leeching" as const, label: "下载中" },
  { value: "none" as const, label: "未下载" },
] satisfies readonly { value: UserStatus; label: string }[];

interface SonarFilterPanelProps {
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onReset: () => void;
  statusFilter: UserStatus;
  sizeFilter: SizeFilter;
  seederFilter: SeederFilter;
  remainingFilter: RemainingFilter;
  modeFilter: ModeFilter;
  density: Density;
  pageSize: number;
  onStatusChange: (value: UserStatus) => void;
  onSizeChange: (value: SizeFilter) => void;
  onSeederChange: (value: SeederFilter) => void;
  onRemainingChange: (value: RemainingFilter) => void;
  onModeChange: (value: ModeFilter) => void;
  onDensityChange: (value: Density) => void;
  onPageSizeChange: (value: string) => void;
}

export function SonarFilterPanel({
  searchValue,
  onSearchValueChange,
  onReset,
  statusFilter,
  sizeFilter,
  seederFilter,
  remainingFilter,
  modeFilter,
  density,
  pageSize,
  onStatusChange,
  onSizeChange,
  onSeederChange,
  onRemainingChange,
  onModeChange,
  onDensityChange,
  onPageSizeChange,
}: SonarFilterPanelProps) {
  return (
    <SectionCard title="筛选器" contentClassName="space-y-5 p-4 sm:p-5">
      <SearchResetBar
        value={searchValue}
        onValueChange={onSearchValueChange}
        onReset={onReset}
        placeholder="搜索种子名称…"
        searchLabel="搜索种子"
      />

      <SegmentedControl
        ariaLabel="按下载状态筛选"
        value={statusFilter}
        options={sonarStatusOptions}
        onValueChange={onStatusChange}
      />

      <FilterPills
        sizeFilter={sizeFilter}
        seederFilter={seederFilter}
        onSizeChange={onSizeChange}
        onSeederChange={onSeederChange}
      />

      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
        <DropdownFilters
          remainingFilter={remainingFilter}
          modeFilter={modeFilter}
          onRemainingChange={onRemainingChange}
          onModeChange={onModeChange}
        />
        <SegmentedControl
          ariaLabel="列表密度"
          value={density}
          options={sonarDensityOptions}
          onValueChange={onDensityChange}
        />
        <Select
          items={sonarPageSizeOptions}
          value={String(pageSize)}
          onValueChange={(value) => {
            if (value) onPageSizeChange(value);
          }}
        >
          <SelectTrigger className="w-full lg:w-32" aria-label="每页显示数量">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sonarPageSizeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </SectionCard>
  );
}
