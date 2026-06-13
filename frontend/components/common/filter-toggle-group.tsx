"use client";

import {
  MultiSegmentedControl,
  SegmentedControl,
  type SegmentedControlOption,
} from "@/components/common/segmented-control";

export type FilterToggleOption<T extends string = string> =
  SegmentedControlOption<T>;

interface FilterToggleGroupProps<T extends string = string> {
  value: T;
  options: readonly FilterToggleOption<T>[];
  onValueChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

interface MultiFilterToggleGroupProps<T extends string = string> {
  value: readonly T[];
  options: readonly FilterToggleOption<T>[];
  onValueChange: (value: T[]) => void;
  ariaLabel: string;
  className?: string;
}

export function FilterToggleGroup<T extends string>({
  value,
  options,
  onValueChange,
  ariaLabel,
  className,
}: FilterToggleGroupProps<T>) {
  return (
    <SegmentedControl
      ariaLabel={ariaLabel}
      value={value}
      options={options}
      onValueChange={onValueChange}
      className={className}
    />
  );
}

export function MultiFilterToggleGroup<T extends string>({
  value,
  options,
  onValueChange,
  ariaLabel,
  className,
}: MultiFilterToggleGroupProps<T>) {
  return (
    <MultiSegmentedControl
      ariaLabel={ariaLabel}
      value={value}
      options={options}
      onValueChange={onValueChange}
      className={className}
    />
  );
}
