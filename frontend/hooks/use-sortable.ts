/**
 * useSortable - Reusable sorting state management hook
 * Handles sort field, direction, and toggle logic
 */

import { useState, useCallback } from "react";

export type SortDirection = "asc" | "desc";

export interface SortState<T extends string = string> {
  field: T;
  direction: SortDirection;
}

export interface UseSortableOptions<T extends string = string> {
  /** Default sort field */
  defaultField: T;
  /** Default sort direction */
  defaultDirection?: SortDirection;
}

export interface UseSortableReturn<T extends string = string> {
  /** Current sort field */
  sortField: T;
  /** Current sort direction */
  sortDirection: SortDirection;
  /** Full sort state object */
  sortState: SortState<T>;
  /** Handle column header click - toggles direction or sets new field */
  handleSort: (field: T) => void;
  /** Check if a specific column is currently sorted */
  isSorted: (field: T) => boolean;
  /** Get sort direction for a specific column (null if not sorted) */
  getSortDirection: (field: T) => SortDirection | null;
  /** Reset to default sort */
  resetSort: () => void;
}

export function useSortable<T extends string = string>({
  defaultField,
  defaultDirection = "desc",
}: UseSortableOptions<T>): UseSortableReturn<T> {
  const [sortState, setSortState] = useState<SortState<T>>({
    field: defaultField,
    direction: defaultDirection,
  });

  const handleSort = useCallback((field: T) => {
    setSortState((prev) => {
      if (prev.field === field) {
        // Same column - toggle direction
        return {
          field,
          direction: prev.direction === "desc" ? "asc" : "desc",
        };
      }
      // New column - default to descending
      return {
        field,
        direction: "desc",
      };
    });
  }, []);

  const isSorted = useCallback(
    (field: T) => sortState.field === field,
    [sortState.field]
  );

  const getSortDirection = useCallback(
    (field: T): SortDirection | null => {
      return sortState.field === field ? sortState.direction : null;
    },
    [sortState.field, sortState.direction]
  );

  const resetSort = useCallback(() => {
    setSortState({
      field: defaultField,
      direction: defaultDirection,
    });
  }, [defaultField, defaultDirection]);

  return {
    sortField: sortState.field,
    sortDirection: sortState.direction,
    sortState,
    handleSort,
    isSorted,
    getSortDirection,
    resetSort,
  };
}
