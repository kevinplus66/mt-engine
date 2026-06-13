/**
 * MT-Engine TypeScript Type Definitions
 * 对应后端 models.py 的数据结构
 */

import type { components } from "./api/generated";

// ============ 搜索相关类型 ============

export type SearchMode = "normal" | "adult" | "movie" | "tvshow" | "other";

export type SearchRequest = components["schemas"]["SearchRequest"];

export interface QualityMetadata {
  resolution?: string;
  video_codec?: string;
  audio_codec?: string;
  source?: string;
  labels_new?: string[];
  country?: string;
}

export interface Torrent {
  id: string;
  name: string;
  small_descr?: string;
  size: number;
  size_display: string;
  seeders: number;
  leechers: number;
  discount: string;
  discount_label: string;
  discount_end_time?: string;
  created_date: string;
  detail_url: string;
  user_status: "none" | "seeding" | "leeching";
  category: number;
  mode?: SearchMode;
  remaining?: {
    hours: number;
    display: string;
  };
  quality_metadata?: QualityMetadata;
  // PANEL 相关字段（来自 qBittorrent）
  hash?: string;
  tags?: string[];
}

export interface SearchResponse {
  success: boolean;
  message?: string;
  data: Torrent[];
  total: number;
  pageNumber: number;
  pageSize: number;
}

// ============ 下载相关类型 ============

export type DownloadRequest = components["schemas"]["DownloadRequest"];

export interface DownloadResponse {
  success: boolean;
  message: string;
}

// ============ Pilot 配置类型 ============

export interface RuleConfig {
  // 基础过滤
  min_size_gb: number;
  max_size_gb: number;
  discount_types: string[];
  include_keywords: string[];
  exclude_keywords: string[];

  // 高级过滤
  max_seeders: number;
  min_leechers: number;

  // 评分权重
  weight_size: number;
  weight_free_time: number;
  weight_age: number;
  weight_seeders: number;
}

export interface DownloadPolicy {
  enabled: boolean;
  max_active_tasks: number;
  interval_seconds: number;
  save_path: string;
  disk_usage_threshold: number;
  rules: RuleConfig;
}

export interface CleanupPolicy {
  enabled: boolean;
  min_share_ratio: number;
  min_seed_time_hours: number;
  max_download_time_hours: number;

  // 死种检测
  dead_seed_minutes: number;
  dead_seed_max_ratio: number;

  // 底部淘汰
  min_current_users: number;
  min_upload_speed_kbps: number;
  elimination_ratio: number;
}

export interface AutomationConfig {
  download: DownloadPolicy;
  cleanup: CleanupPolicy;
  enable_notification: boolean;
}

// ============ Pilot 统计类型 ============

export interface PilotStats {
  total_downloads: number;
  total_cleanups: number;
  active_tasks: number;
  pending_downloads: number;
  last_run?: string;
  next_run?: string;
  is_running: boolean;
  disk_usage_percent?: number;
}

export interface DryRunResult {
  download_candidates: Array<{
    id: string;
    name: string;
    size_gb: number;
    score: number;
    reason: string;
  }>;
  total_download_candidates: number;
  cleanup_candidates: Array<{
    name: string;
    hash: string;
    ratio: number;
    reason: string;
  }>;
  total_cleanup_candidates: number;
}

// ============ Panel 数据类型 ============

export interface PanelStats {
  total_upload: number;
  total_download: number;
  share_ratio: number;
  active_torrents: number;
  seeding_count: number;
  downloading_count: number;
  upload_speed: number;
  download_speed: number;
}

export interface HistoryDataPoint {
  timestamp: string;
  upload: number;
  download: number;
  ratio: number;
}

export type TimeRange = "1h" | "6h" | "24h" | "7d" | "30d";

// ============ 通用响应类型 ============

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  torrents_count?: number;
}

export type RuntimeStatus = components["schemas"]["ApiStatusResponse"];

// ============ Home 媒体墙类型 ============

export type MediaWallRailId =
  | "western_series"
  | "foreign_movies"
  | "asian_series"
  | "chinese_series"
  | "classic_restorations"
  | "quality_latest"
  | "popular_media";

export type MediaWallMediaType = "movie" | "series" | "other";

export interface MediaWallItem {
  id: string;
  media_key: string;
  title: string;
  torrent_name: string;
  poster_url?: string | null;
  detail_url: string;
  year: string;
  media_type: MediaWallMediaType;
  episode?: string | null;
  quality_tags: string[];
  rail_reason: string;
  created_date: string;
  size: number;
  size_display: string;
  seeders: number;
  leechers: number;
  times_completed: number;
  discount: string;
  douban?: string | null;
  imdb?: string | null;
  douban_rating?: unknown;
  imdb_rating?: unknown;
  description?: string | null;
}

export interface MediaWallRail {
  id: MediaWallRailId;
  title: string;
  description: string;
  items: MediaWallItem[];
}

export interface MediaWallDiagnosticsCount {
  count?: number;
  [key: string]: unknown;
}

export type MediaWallDiagnosticsSource = number | MediaWallDiagnosticsCount;

export interface MediaWallDiagnosticsRail extends MediaWallDiagnosticsCount {
  items?: number;
  strict?: number;
  relaxed?: number;
  fallback?: number;
  strict_count?: number;
  relaxed_count?: number;
  fallback_count?: number;
}

export interface MediaWallDiagnostics {
  sources?: Record<string, MediaWallDiagnosticsSource>;
  rails?: Record<string, MediaWallDiagnosticsRail>;
  [key: string]: unknown;
}

export interface MediaWallResponse {
  last_refreshed?: string | null;
  next_refresh?: string | null;
  stale: boolean;
  refresh_status: "ok" | "empty" | "error";
  last_error?: string | null;
  rails: MediaWallRail[];
  diagnostics?: MediaWallDiagnostics;
}

// ============ Auto Delete 类型 ============

export interface AutoDeleteStatus {
  enabled: boolean;
}

export type AutoDeleteToggleRequest =
  components["schemas"]["AutoDeleteToggleRequest"];
export type DeleteTorrentsRequest =
  components["schemas"]["DeleteTorrentsRequest"];
export type PauseTorrentsRequest =
  components["schemas"]["PauseTorrentsRequest"];
export type ResumeTorrentsRequest =
  components["schemas"]["ResumeTorrentsRequest"];

// ============ 分类和筛选选项类型 ============

export interface CategoryOption {
  id: string | number;
  name_zh: string;
  name_en: string;
}

export interface FilterOption {
  id: string | number;
  name_zh: string;
  name_en: string;
}

export interface FilterOptions {
  categories: CategoryOption[];
  standards: FilterOption[];
  videoCodecs: FilterOption[];
  audioCodecs: FilterOption[];
  sources: FilterOption[];
  countries: FilterOption[];
}
