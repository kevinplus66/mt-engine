/**
 * MT-Engine TypeScript Type Definitions
 * 对应后端 models.py 的数据结构
 */

// ============ 搜索相关类型 ============

export type SearchMode = "normal" | "adult" | "movie" | "tvshow" | "other";

export interface SearchRequest {
  keyword: string;
  mode: SearchMode;
  categories: number[];
  standards: number[];
  videoCodecs: number[];
  audioCodecs: number[];
  sources: number[];
  countries: number[];
  discount: string;
  sortField: string;
  sortDirection: string;
  pageNumber: number;
  pageSize: number;
}

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

export interface DownloadRequest {
  id: string;
}

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

// ============ Auto Delete 类型 ============

export interface AutoDeleteStatus {
  enabled: boolean;
}

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
