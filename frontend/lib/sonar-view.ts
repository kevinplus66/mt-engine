export type UserStatus = "all" | "seeding" | "leeching" | "none";
export type SonarSortField = "name" | "size" | "seeders" | "remaining";
export type Density = "compact" | "comfortable";

export type QueryUpdate = {
  name: string;
  value: string;
  defaultValue?: string;
};

export const DEFAULT_SONAR_PAGE = 1;
export const DEFAULT_SONAR_PAGE_SIZE = 50;
export const DEFAULT_SONAR_DENSITY: Density = "compact";
export const SONAR_PAGE_SIZES = [25, 50];
export const SONAR_DENSITIES: Density[] = ["compact", "comfortable"];
export const SONAR_QUERY_PARAMS = [
  "q",
  "status",
  "size",
  "seeders",
  "remaining",
  "mode",
  "page",
  "pageSize",
  "density",
];

export const sonarPageSizeOptions = [
  { value: "25", label: "每页 25" },
  { value: "50", label: "每页 50" },
];

export const sonarDensityOptions = [
  { value: "compact" as const, label: "紧凑" },
  { value: "comfortable" as const, label: "舒适" },
];

export function parsePositiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseSonarPageSize(value: string | null) {
  const parsed = parsePositiveInteger(value, DEFAULT_SONAR_PAGE_SIZE);
  return SONAR_PAGE_SIZES.includes(parsed) ? parsed : DEFAULT_SONAR_PAGE_SIZE;
}

export function parseSonarDensity(value: string | null): Density {
  return SONAR_DENSITIES.includes(value as Density)
    ? (value as Density)
    : DEFAULT_SONAR_DENSITY;
}

export function parseSonarViewQuery(searchParams: URLSearchParams) {
  return {
    page: parsePositiveInteger(searchParams.get("page"), DEFAULT_SONAR_PAGE),
    pageSize: parseSonarPageSize(searchParams.get("pageSize")),
    density: parseSonarDensity(searchParams.get("density")),
  };
}

export function setQueryValue(
  params: URLSearchParams,
  name: string,
  value: string,
  defaultValue = "",
) {
  if (!value || value === "all" || value === defaultValue) {
    params.delete(name);
  } else {
    params.set(name, value);
  }
}
