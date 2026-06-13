/**
 * SortableTableHead - Clickable table header with sort indicators
 * Visual indicators: ArrowUpDown (unsorted), ArrowUp (asc), ArrowDown (desc)
 */

"use client";

import * as React from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TableHead } from "@/components/ui/table";
import type { SortDirection } from "@/hooks/use-sortable";

interface SortableTableHeadProps
  extends React.ComponentProps<typeof TableHead> {
  /** Column identifier for sort state */
  sortKey: string;
  /** Current sort direction (null if not sorted by this column) */
  sortDirection: SortDirection | null;
  /** Callback when header is clicked */
  onSort: (key: string) => void;
  /** Whether sorting is enabled for this column */
  sortable?: boolean;
  children: React.ReactNode;
}

export function SortableTableHead({
  sortKey,
  sortDirection,
  onSort,
  sortable = true,
  className,
  children,
  "aria-label": ariaLabel,
  ...props
}: SortableTableHeadProps) {
  const isSorted = sortDirection !== null;
  const ariaSort: React.AriaAttributes["aria-sort"] = isSorted
    ? sortDirection === "asc"
      ? "ascending"
      : "descending"
    : "none";
  const buttonLabel =
    typeof ariaLabel === "string"
      ? ariaLabel
      : `按${typeof children === "string" ? children.trim() || "列" : "列"}排序`;
  // Determine which icon to show
  const SortIcon = isSorted
    ? sortDirection === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  if (!sortable) {
    return (
      <TableHead {...props} aria-label={ariaLabel} className={className}>
        {children}
      </TableHead>
    );
  }

  return (
    <TableHead
      {...props}
      aria-label={ariaLabel}
      aria-sort={ariaSort}
      className={className}
    >
      <button
        type="button"
        className="flex h-full min-h-10 w-full cursor-pointer select-none items-center gap-1.5 rounded-sm bg-transparent p-0 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        onClick={() => onSort(sortKey)}
        aria-label={buttonLabel}
      >
        <span>{children}</span>
        <SortIcon
          className={cn(
            "h-3.5 w-3.5 transition-opacity",
            isSorted ? "opacity-100" : "opacity-40"
          )}
          aria-hidden="true"
        />
      </button>
    </TableHead>
  );
}
