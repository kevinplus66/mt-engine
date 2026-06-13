"use client";

import type { ReactNode } from "react";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export type SegmentedControlOption<T extends string = string> = {
  value: T;
  label: ReactNode;
  className?: string;
};

type SegmentedControlBaseProps<T extends string = string> = {
  options: readonly SegmentedControlOption<T>[];
  ariaLabel: string;
  className?: string;
  itemClassName?: string;
  fullWidth?: boolean;
};

type SegmentedControlProps<T extends string = string> =
  SegmentedControlBaseProps<T> & {
    value: T;
    onValueChange: (value: T) => void;
  };

type MultiSegmentedControlProps<T extends string = string> =
  SegmentedControlBaseProps<T> & {
    value: readonly T[];
    onValueChange: (value: T[]) => void;
  };

const viewportClassName =
  "max-w-full overflow-x-auto rounded-lg [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const trackClassName =
  "flex-nowrap rounded-lg bg-muted/72 p-1 text-muted-foreground dark:bg-muted/80";

const defaultItemClassName =
  "rounded-md border-transparent px-3 text-muted-foreground shadow-none transition-[background-color,color,box-shadow] hover:bg-background/64 hover:text-foreground data-pressed:bg-background data-pressed:text-foreground data-pressed:shadow-sm dark:hover:bg-input/64 dark:data-pressed:bg-input dark:data-pressed:text-foreground";

export function SegmentedControl<T extends string>({
  value,
  options,
  onValueChange,
  ariaLabel,
  className,
  itemClassName,
  fullWidth,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn(viewportClassName, className)}>
      <ToggleGroup
        aria-label={ariaLabel}
        className={cn(trackClassName, fullWidth ? "w-full" : "w-fit")}
        value={[value]}
        onValueChange={(nextValue) => {
          const selected = nextValue.at(-1);
          if (selected) onValueChange(selected as T);
        }}
        variant="default"
        size="default"
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className={cn(defaultItemClassName, itemClassName, option.className)}
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export function MultiSegmentedControl<T extends string>({
  value,
  options,
  onValueChange,
  ariaLabel,
  className,
  itemClassName,
  fullWidth,
}: MultiSegmentedControlProps<T>) {
  return (
    <div className={cn(viewportClassName, className)}>
      <ToggleGroup
        aria-label={ariaLabel}
        className={cn(trackClassName, fullWidth ? "w-full" : "w-fit")}
        value={value}
        onValueChange={(nextValue) => onValueChange(nextValue as T[])}
        multiple
        variant="default"
        size="default"
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className={cn(defaultItemClassName, itemClassName, option.className)}
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
