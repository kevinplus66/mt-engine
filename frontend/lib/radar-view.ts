import type { SortDirection } from "@/hooks/use-sortable";
import { CATEGORY_MAP, FILTER_CONFIG } from "@/lib/constants";
import { RADAR_SORT_FIELD_MAP } from "@/lib/sort-utils";
import type { SearchMode, SearchRequest } from "@/lib/types";

export type RadarSortField = "name" | "size" | "seeders" | "time";

export type RadarFilters = {
  standards: number[];
  videoCodecs: number[];
  audioCodecs: number[];
  sources: number[];
  countries: number[];
  discount: string;
};

const FILTER_KEYS_BY_FIELD = {
  standards: "resolution",
  videoCodecs: "video",
  audioCodecs: "audio",
  sources: "source",
  countries: "country",
  discount: "discount",
} as const satisfies Record<keyof RadarFilters, string>;

export type RadarQueryState = {
  keyword: string;
  mode: SearchMode;
  selectedCategories: number[];
  filters: RadarFilters;
  sortField: RadarSortField;
  sortDirection: SortDirection;
};

const SEARCH_MODES: SearchMode[] = [
  "normal",
  "adult",
  "movie",
  "tvshow",
  "other",
];

const RADAR_SORT_FIELDS: RadarSortField[] = [
  "name",
  "size",
  "seeders",
  "time",
];

const SORT_DIRECTIONS: SortDirection[] = ["asc", "desc"];

export const DEFAULT_RADAR_MODE: SearchMode = "normal";
export const DEFAULT_RADAR_SORT_FIELD: RadarSortField = "time";
export const DEFAULT_RADAR_SORT_DIRECTION: SortDirection = "desc";

export function createDefaultRadarFilters(): RadarFilters {
  return {
    standards: [],
    videoCodecs: [],
    audioCodecs: [],
    sources: [],
    countries: [],
    discount: "",
  };
}

function parseNumberList(value: string | null): number[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
}

function parseSearchMode(value: string | null): SearchMode {
  return SEARCH_MODES.includes(value as SearchMode)
    ? (value as SearchMode)
    : DEFAULT_RADAR_MODE;
}

function parseRadarSortField(value: string | null): RadarSortField {
  return RADAR_SORT_FIELDS.includes(value as RadarSortField)
    ? (value as RadarSortField)
    : DEFAULT_RADAR_SORT_FIELD;
}

function parseSortDirection(value: string | null): SortDirection {
  const normalized = value?.toLowerCase();
  return SORT_DIRECTIONS.includes(normalized as SortDirection)
    ? (normalized as SortDirection)
    : DEFAULT_RADAR_SORT_DIRECTION;
}

function setQueryValue(
  params: URLSearchParams,
  name: string,
  value: string,
  defaultValue = "",
) {
  if (!value || value === defaultValue) {
    params.delete(name);
  } else {
    params.set(name, value);
  }
}

function setNumberListQuery(
  params: URLSearchParams,
  name: string,
  values: number[],
) {
  if (values.length === 0) {
    params.delete(name);
  } else {
    params.set(name, values.join(","));
  }
}

function getRadarCategoryIds(mode: SearchMode): Set<number> {
  const ids = new Set<number>();
  for (const category of CATEGORY_MAP[mode] || []) {
    for (const id of String(category.id).split(",")) {
      const parsed = Number(id);
      if (Number.isFinite(parsed)) ids.add(parsed);
    }
  }
  return ids;
}

export function sanitizeRadarCategoriesForMode(
  mode: SearchMode,
  selectedCategories: number[],
): number[] {
  const visibleCategories = getRadarCategoryIds(mode);
  if (visibleCategories.size === 0) return [];
  return selectedCategories.filter((id) => visibleCategories.has(id));
}

export function sanitizeRadarFiltersForMode(
  mode: SearchMode,
  filters: RadarFilters,
): RadarFilters {
  const visibleFilters = new Set(FILTER_CONFIG[mode] || []);

  return {
    standards: visibleFilters.has(FILTER_KEYS_BY_FIELD.standards)
      ? filters.standards
      : [],
    videoCodecs: visibleFilters.has(FILTER_KEYS_BY_FIELD.videoCodecs)
      ? filters.videoCodecs
      : [],
    audioCodecs: visibleFilters.has(FILTER_KEYS_BY_FIELD.audioCodecs)
      ? filters.audioCodecs
      : [],
    sources: visibleFilters.has(FILTER_KEYS_BY_FIELD.sources)
      ? filters.sources
      : [],
    countries: visibleFilters.has(FILTER_KEYS_BY_FIELD.countries)
      ? filters.countries
      : [],
    discount: visibleFilters.has(FILTER_KEYS_BY_FIELD.discount)
      ? filters.discount
      : "",
  };
}

export function sanitizeRadarQueryState(state: RadarQueryState): RadarQueryState {
  return {
    ...state,
    selectedCategories: sanitizeRadarCategoriesForMode(
      state.mode,
      state.selectedCategories,
    ),
    filters: sanitizeRadarFiltersForMode(state.mode, state.filters),
  };
}

export function parseRadarQuery(searchParams: URLSearchParams): RadarQueryState {
  const discount = searchParams.get("discount");

  const mode = parseSearchMode(searchParams.get("mode"));
  return sanitizeRadarQueryState({
    keyword: searchParams.get("keyword") ?? searchParams.get("q") ?? "",
    mode,
    selectedCategories: parseNumberList(searchParams.get("categories")),
    filters: {
      standards: parseNumberList(searchParams.get("standards")),
      videoCodecs: parseNumberList(searchParams.get("videoCodecs")),
      audioCodecs: parseNumberList(searchParams.get("audioCodecs")),
      sources: parseNumberList(searchParams.get("sources")),
      countries: parseNumberList(searchParams.get("countries")),
      discount: discount && discount !== "all" ? discount : "",
    },
    sortField: parseRadarSortField(
      searchParams.get("sortField") ?? searchParams.get("sort"),
    ),
    sortDirection: parseSortDirection(
      searchParams.get("sortDirection") ?? searchParams.get("direction"),
    ),
  });
}

export function applyRadarQuery(
  params: URLSearchParams,
  state: RadarQueryState,
) {
  params.delete("q");
  params.delete("sort");
  params.delete("direction");

  const sanitizedState = sanitizeRadarQueryState(state);

  setQueryValue(params, "keyword", sanitizedState.keyword);
  setQueryValue(params, "mode", sanitizedState.mode, DEFAULT_RADAR_MODE);
  setNumberListQuery(params, "categories", sanitizedState.selectedCategories);
  setNumberListQuery(params, "standards", sanitizedState.filters.standards);
  setNumberListQuery(params, "videoCodecs", sanitizedState.filters.videoCodecs);
  setNumberListQuery(params, "audioCodecs", sanitizedState.filters.audioCodecs);
  setNumberListQuery(params, "sources", sanitizedState.filters.sources);
  setNumberListQuery(params, "countries", sanitizedState.filters.countries);
  setQueryValue(
    params,
    "discount",
    sanitizedState.filters.discount === "all"
      ? ""
      : sanitizedState.filters.discount,
  );
  setQueryValue(
    params,
    "sortField",
    sanitizedState.sortField,
    DEFAULT_RADAR_SORT_FIELD,
  );
  setQueryValue(
    params,
    "sortDirection",
    sanitizedState.sortDirection,
    DEFAULT_RADAR_SORT_DIRECTION,
  );
}

export function buildRadarSearchRequest(
  state: RadarQueryState,
): SearchRequest {
  const sanitizedState = sanitizeRadarQueryState(state);

  return {
    keyword: sanitizedState.keyword,
    mode: sanitizedState.mode,
    categories: sanitizedState.selectedCategories,
    standards: sanitizedState.filters.standards,
    videoCodecs: sanitizedState.filters.videoCodecs,
    audioCodecs: sanitizedState.filters.audioCodecs,
    sources: sanitizedState.filters.sources,
    countries: sanitizedState.filters.countries,
    discount: sanitizedState.filters.discount,
    sortField:
      RADAR_SORT_FIELD_MAP[sanitizedState.sortField] || "CREATED_DATE",
    sortDirection: sanitizedState.sortDirection.toUpperCase(),
    pageNumber: 1,
    pageSize: 50,
  };
}
