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
  ...props
}: SortableTableHeadProps) {
  const isSorted = sortDirection !== null;

  // Determine which icon to show
  const SortIcon = isSorted
    ? sortDirection === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  if (!sortable) {
    return (
      <TableHead className={className} {...props}>
        {children}
      </TableHead>
    );
  }

  return (
    <TableHead
      className={cn(
        "cursor-pointer select-none hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors",
        className
      )}
      onClick={() => onSort(sortKey)}
      {...props}
    >
      <div className="flex items-center gap-1.5">
        <span>{children}</span>
        <SortIcon
          className={cn(
            "h-3.5 w-3.5 transition-opacity",
            isSorted ? "opacity-100" : "opacity-40"
          )}
        />
      </div>
    </TableHead>
  );
}
