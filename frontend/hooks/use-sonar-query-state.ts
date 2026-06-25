"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ModeFilter, RemainingFilter } from "@/components/sonar/dropdown-filters";
import type { SeederFilter, SizeFilter } from "@/components/sonar/filter-pills";
import { useDebounce } from "@/hooks/use-debounce";
import {
  DEFAULT_SONAR_DENSITY,
  DEFAULT_SONAR_PAGE,
  DEFAULT_SONAR_PAGE_SIZE,
  parseSonarDensity,
  parseSonarPageSize,
  parseSonarViewQuery,
  setQueryValue,
  SONAR_PAGE_SIZES,
  SONAR_QUERY_PARAMS,
  type Density,
  type QueryUpdate,
  type UserStatus,
} from "@/lib/sonar-view";

export function useSonarQueryState() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const viewState = useMemo(
    () => parseSonarViewQuery(new URLSearchParams(queryString)),
    [queryString],
  );
  const [page, setPage] = useState(viewState.page);
  const [pageSize, setPageSize] = useState(viewState.pageSize);
  const [density, setDensity] = useState<Density>(viewState.density);

  useEffect(() => {
    setPage(viewState.page);
    setPageSize(viewState.pageSize);
    setDensity(viewState.density);
  }, [viewState]);

  const replaceQuery = useCallback(
    (updates: QueryUpdate[]) => {
      const params = new URLSearchParams(searchParams.toString());
      updates.forEach(({ name, value, defaultValue }) => {
        setQueryValue(params, name, value, defaultValue);
      });
      const nextQuery = params.toString();
      router.replace(nextQuery ? `?${nextQuery}` : "/sonar", {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  const updateParam = useCallback(
    (name: string, value: string, resetPage = true) => {
      const updates: QueryUpdate[] = [{ name, value }];
      if (resetPage) {
        updates.push({
          name: "page",
          value: String(DEFAULT_SONAR_PAGE),
          defaultValue: String(DEFAULT_SONAR_PAGE),
        });
      }
      replaceQuery(updates);
    },
    [replaceQuery],
  );

  useEffect(() => {
    const rawPageSize = searchParams.get("pageSize");
    if (!rawPageSize || SONAR_PAGE_SIZES.includes(Number(rawPageSize))) return;

    replaceQuery([
      {
        name: "pageSize",
        value: String(DEFAULT_SONAR_PAGE_SIZE),
        defaultValue: String(DEFAULT_SONAR_PAGE_SIZE),
      },
    ]);
  }, [replaceQuery, searchParams]);

  const statusFilter = (searchParams.get("status") as UserStatus) || "all";
  const sizeFilter = (searchParams.get("size") as SizeFilter) || "all";
  const seederFilter = (searchParams.get("seeders") as SeederFilter) || "all";
  const remainingFilter =
    (searchParams.get("remaining") as RemainingFilter) || "all";
  const modeFilter = (searchParams.get("mode") as ModeFilter) || "all";
  const searchParam = searchParams.get("q") || "";
  const [searchValue, setSearchValueState] = useState(searchParam);
  const hasPendingLocalSearchRef = useRef(false);
  const lastSearchParamRef = useRef(searchParam);
  const setSearchValue = useCallback((value: string) => {
    hasPendingLocalSearchRef.current = true;
    setSearchValueState(value);
  }, []);
  const debouncedSearch = useDebounce(searchValue, 300);

  useEffect(() => {
    if (
      hasPendingLocalSearchRef.current &&
      lastSearchParamRef.current === searchParam &&
      debouncedSearch === searchValue &&
      debouncedSearch !== searchParam
    ) {
      hasPendingLocalSearchRef.current = false;
      updateParam("q", debouncedSearch);
    }
  }, [debouncedSearch, searchParam, searchValue, updateParam]);

  useEffect(() => {
    if (lastSearchParamRef.current === searchParam) return;
    lastSearchParamRef.current = searchParam;
    hasPendingLocalSearchRef.current = false;
    setSearchValueState(searchParam);
  }, [searchParam]);

  const reset = useCallback(() => {
    hasPendingLocalSearchRef.current = false;
    setSearchValueState("");
    setPage(DEFAULT_SONAR_PAGE);
    setPageSize(DEFAULT_SONAR_PAGE_SIZE);
    setDensity(DEFAULT_SONAR_DENSITY);

    const params = new URLSearchParams(searchParams.toString());
    SONAR_QUERY_PARAMS.forEach((name) => params.delete(name));
    const nextQuery = params.toString();
    router.replace(nextQuery ? `?${nextQuery}` : "/sonar", { scroll: false });
  }, [router, searchParams]);

  const setPageParam = useCallback(
    (nextPage: number) => {
      setPage(nextPage);
      replaceQuery([
        {
          name: "page",
          value: String(nextPage),
          defaultValue: String(DEFAULT_SONAR_PAGE),
        },
      ]);
    },
    [replaceQuery],
  );

  const setPageSizeParam = useCallback(
    (value: string) => {
      const nextPageSize = parseSonarPageSize(value);
      setPage(DEFAULT_SONAR_PAGE);
      setPageSize(nextPageSize);
      replaceQuery([
        {
          name: "pageSize",
          value: String(nextPageSize),
          defaultValue: String(DEFAULT_SONAR_PAGE_SIZE),
        },
        {
          name: "page",
          value: String(DEFAULT_SONAR_PAGE),
          defaultValue: String(DEFAULT_SONAR_PAGE),
        },
      ]);
    },
    [replaceQuery],
  );

  const setDensityParam = useCallback(
    (value: Density) => {
      const nextDensity = parseSonarDensity(value);
      setDensity(nextDensity);
      replaceQuery([
        {
          name: "density",
          value: nextDensity,
          defaultValue: DEFAULT_SONAR_DENSITY,
        },
      ]);
    },
    [replaceQuery],
  );

  return {
    page,
    pageSize,
    density,
    searchValue,
    debouncedSearch,
    setSearchValue,
    statusFilter,
    sizeFilter,
    seederFilter,
    remainingFilter,
    modeFilter,
    updateParam,
    reset,
    setPageParam,
    setPageSizeParam,
    setDensityParam,
  };
}
