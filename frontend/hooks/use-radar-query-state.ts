"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { SortDirection } from "@/hooks/use-sortable";
import {
  applyRadarQuery,
  createDefaultRadarFilters,
  DEFAULT_RADAR_MODE,
  DEFAULT_RADAR_SORT_DIRECTION,
  DEFAULT_RADAR_SORT_FIELD,
  parseRadarQuery,
  sanitizeRadarQueryState,
  type RadarFilters,
  type RadarQueryState,
  type RadarSortField,
} from "@/lib/radar-view";
import type { SearchMode } from "@/lib/types";

export function useRadarQueryState() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const queryState = useMemo(
    () => parseRadarQuery(new URLSearchParams(queryString)),
    [queryString],
  );

  const [keyword, setKeyword] = useState(queryState.keyword);
  const [mode, setMode] = useState<SearchMode>(queryState.mode);
  const [selectedCategories, setSelectedCategories] = useState<number[]>(
    queryState.selectedCategories,
  );
  const [filters, setFilters] = useState<RadarFilters>(queryState.filters);
  const [sortField, setSortField] = useState<RadarSortField>(
    queryState.sortField,
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    queryState.sortDirection,
  );

  useEffect(() => {
    setKeyword(queryState.keyword);
    setMode(queryState.mode);
    setSelectedCategories(queryState.selectedCategories);
    setFilters(queryState.filters);
    setSortField(queryState.sortField);
    setSortDirection(queryState.sortDirection);
  }, [queryState]);

  const replaceQuery = useCallback(
    (state: RadarQueryState) => {
      const sanitizedState = sanitizeRadarQueryState(state);
      const params = new URLSearchParams(searchParams.toString());
      applyRadarQuery(params, sanitizedState);
      const nextQuery = params.toString();
      router.replace(nextQuery ? `?${nextQuery}` : "/radar", {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  const currentState = useMemo<RadarQueryState>(
    () => ({
      keyword,
      mode,
      selectedCategories,
      filters,
      sortField,
      sortDirection,
    }),
    [filters, keyword, mode, selectedCategories, sortDirection, sortField],
  );

  const updateQueryState = useCallback(
    (overrides: Partial<RadarQueryState>) => {
      replaceQuery({ ...currentState, ...overrides });
    },
    [currentState, replaceQuery],
  );

  const handleKeywordChange = (nextKeyword: string) => {
    setKeyword(nextKeyword);
    updateQueryState({ keyword: nextKeyword });
  };

  const handleModeChange = (nextMode: SearchMode) => {
    const nextState = sanitizeRadarQueryState({
      ...currentState,
      mode: nextMode,
    });

    setMode(nextState.mode);
    setSelectedCategories(nextState.selectedCategories);
    setFilters(nextState.filters);
    updateQueryState(nextState);
  };

  const handleCategoriesChange = (nextCategories: number[]) => {
    setSelectedCategories(nextCategories);
    updateQueryState({ selectedCategories: nextCategories });
  };

  const handleFiltersChange = (nextFilters: RadarFilters) => {
    setFilters(nextFilters);
    updateQueryState({ filters: nextFilters });
  };

  const setSort = (field: RadarSortField, direction: SortDirection) => {
    setSortField(field);
    setSortDirection(direction);
    updateQueryState({ sortField: field, sortDirection: direction });
  };

  const resetQueryState = () => {
    const nextFilters = createDefaultRadarFilters();
    const nextState = {
      keyword: "",
      mode: DEFAULT_RADAR_MODE,
      selectedCategories: [],
      filters: nextFilters,
      sortField: DEFAULT_RADAR_SORT_FIELD,
      sortDirection: DEFAULT_RADAR_SORT_DIRECTION,
    };

    setKeyword(nextState.keyword);
    setMode(nextState.mode);
    setSelectedCategories(nextState.selectedCategories);
    setFilters(nextState.filters);
    setSortField(nextState.sortField);
    setSortDirection(nextState.sortDirection);
    replaceQuery(nextState);
  };

  return {
    keyword,
    mode,
    selectedCategories,
    filters,
    sortField,
    sortDirection,
    currentState,
    handleKeywordChange,
    handleModeChange,
    handleCategoriesChange,
    handleFiltersChange,
    setSort,
    resetQueryState,
  };
}
