/**
 * MT-Engine API Client
 * 封装 fetch 请求，提供统一的错误处理
 */

import { CONFIG } from "./constants";
import type {
  BackendPanelDeleteTorrentsResponse,
  BackendPanelPauseTorrentsResponse,
  BackendPanelResumeTorrentsResponse,
} from "./api-models";
import type { ApiResponse } from "./types";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function stringifyErrorObject(value: object): string | null {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function formatApiErrorValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    const messages = value
      .map((item) => formatApiErrorValue(item))
      .filter((item): item is string => Boolean(item));
    return messages.length > 0 ? messages.join("; ") : null;
  }

  if (value && typeof value === "object") {
    const error = value as Record<string, unknown>;
    return (
      formatApiErrorValue(error.msg) ||
      formatApiErrorValue(error.message) ||
      formatApiErrorValue(error.detail) ||
      formatApiErrorValue(error.error) ||
      stringifyErrorObject(error)
    );
  }

  return null;
}

function getApiErrorMessage(payload: unknown): string | null {
  if (payload && typeof payload === "object") {
    const error = payload as Record<string, unknown>;
    return (
      formatApiErrorValue(error.message) ||
      formatApiErrorValue(error.detail) ||
      formatApiErrorValue(error.error)
    );
  }

  return formatApiErrorValue(payload);
}

function assertDownloadSuccess(response: DownloadResponse) {
  if (response.success) return;

  throw new ApiError(400, getApiErrorMessage(response) || "下载失败");
}

function normalizeApiBase(apiBase: string): string {
  return apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
}

function isApiPath(url: string): boolean {
  return url === "/api" || url.startsWith("/api/");
}

function hasApiBase(url: string, apiBase: string): boolean {
  return (
    url === apiBase ||
    (url.startsWith(apiBase) && url.charCodeAt(apiBase.length) === 47)
  );
}

function resolveFetcherUrl(url: string): string {
  const apiBase = normalizeApiBase(CONFIG.API_BASE);
  if (!apiBase || !isApiPath(url) || hasApiBase(url, apiBase)) {
    return url;
  }

  return `${apiBase}${url}`;
}

/**
 * 基础 fetcher 函数，用于 SWR
 */
export async function fetcher<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const requestUrl = resolveFetcherUrl(url);
  const response = await fetch(requestUrl, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const error = await parseErrorResponse(response, requestUrl);
    throw new ApiError(
      response.status,
      error || `HTTP ${response.status}`
    );
  }

  return response.json();
}

async function parseErrorResponse(
  response: Response,
  url: string
): Promise<string> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const error = await response.json().catch(() => null);
    const message = getApiErrorMessage(error);
    if (message) return message;
  }

  const text = (await response.text().catch(() => "")).trim();
  const fallback = text || response.statusText || `HTTP ${response.status}`;

  if (response.status === 500 && fallback === "Internal Server Error") {
    return `后端服务暂时不可达（${url}）。请检查 API 地址或网络连接。`;
  }

  return fallback;
}

/**
 * API 客户端类
 */
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = CONFIG.API_BASE) {
    this.baseUrl = baseUrl;
  }

  private getUrl(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  async get<T = unknown>(path: string): Promise<T> {
    return fetcher<T>(this.getUrl(path));
  }

  async post<T = unknown>(path: string, data?: unknown): Promise<T> {
    return fetcher<T>(this.getUrl(path), {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = unknown>(path: string, data?: unknown): Promise<T> {
    return fetcher<T>(this.getUrl(path), {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = unknown>(path: string): Promise<T> {
    return fetcher<T>(this.getUrl(path), {
      method: "DELETE",
    });
  }
}

export const api = new ApiClient();

// ============ 具体的 API 方法 ============

import type {
  SearchRequest,
  SearchResponse,
  DownloadRequest,
  DownloadResponse,
  AutomationConfig,
  AutoDeleteStatus,
  AutoDeleteToggleRequest,
  HealthStatus,
  RuntimeStatus,
  DryRunResult,
  DeleteTorrentsRequest,
  PauseTorrentsRequest,
  ResumeTorrentsRequest,
  MediaWallResponse,
} from "./types";

/**
 * HOME - 后端健康状态
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  return api.get<HealthStatus>("/health");
}

/**
 * HOME - 后端运行状态
 */
export async function getRuntimeStatus(): Promise<RuntimeStatus> {
  try {
    return await api.get<RuntimeStatus>("/api/status");
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) {
      throw error;
    }
  }

  const health = await getHealthStatus();
  return {
    status: health.status,
    version: "legacy",
    commit: "unknown",
    timestamp: health.timestamp,
    cache: {
      last_update: health.timestamp,
      last_success: health.timestamp,
      next_refresh: null,
      age_seconds: null,
      stale: false,
      stale_after_seconds: 0,
      total: health.torrents_count ?? 0,
      error: null,
      last_error: null,
    },
    panel_collector: {
      last_started: null,
      last_success: null,
      last_error: null,
      last_duration_seconds: null,
      next_refresh: null,
      heartbeat_age_seconds: null,
      stale: false,
      stale_after_seconds: 0,
    },
    dependencies: {},
    config: {
      debug: false,
      refresh_interval_seconds: 0,
      panel_collect_interval_seconds: 0,
      media_wall_refresh_interval_seconds: 0,
      media_wall_startup_delay_seconds: 0,
      media_wall_source_stagger_seconds: 0,
      media_wall_douban_poster_fetches: 0,
      api_delay_seconds: 0,
      qbittorrent_configured: false,
      mteam_token_configured: false,
      mteam_user_configured: false,
    },
    warnings: [],
  };
}

/**
 * HOME - 只读媒体墙缓存
 */
export async function getHomeMediaWall(): Promise<MediaWallResponse> {
  return api.get<MediaWallResponse>("/api/home/media-wall");
}

/**
 * RADAR - 搜索种子
 */
export async function searchTorrents(
  request: SearchRequest
): Promise<SearchResponse> {
  const response = await api.post<SearchResponse>("/api/radar", request);

  // 检查业务层错误
  if (!response.success) {
    throw new ApiError(400, response.message || "搜索失败");
  }

  return response;
}

/**
 * RADAR - 下载种子
 */
export async function downloadTorrent(
  request: DownloadRequest
): Promise<DownloadResponse> {
  const response = await api.post<DownloadResponse>(
    "/api/radar/download",
    request
  );
  assertDownloadSuccess(response);
  return response;
}

/**
 * SONAR - 触发手动刷新
 */
export async function refreshTorrents(): Promise<ApiResponse> {
  return api.post<ApiResponse>("/api/refresh");
}

/**
 * SONAR - 下载种子
 */
export async function downloadSonarTorrent(
  request: DownloadRequest
): Promise<DownloadResponse> {
  const response = await api.post<DownloadResponse>("/api/download", request);
  assertDownloadSuccess(response);
  return response;
}

/**
 * SONAR - 切换自动删除
 */
export async function toggleAutoDelete(
  enabled: boolean
): Promise<AutoDeleteStatus> {
  const request: AutoDeleteToggleRequest = { enabled };
  return api.post<AutoDeleteStatus>("/api/auto-delete/toggle", request);
}

/**
 * PILOT - 获取配置
 */
export async function getPilotConfig(): Promise<AutomationConfig> {
  return api.get<AutomationConfig>("/api/pilot/config");
}

/**
 * PILOT - 保存配置
 */
export async function savePilotConfig(
  config: AutomationConfig
): Promise<ApiResponse> {
  return api.post<ApiResponse>("/api/pilot/config", config);
}

/**
 * PILOT - 模拟运行
 */
export async function dryRunPilot(): Promise<DryRunResult> {
  return api.get<DryRunResult>("/api/pilot/dry-run");
}

/**
 * PILOT - 手动触发下载
 */
export async function triggerDownload(): Promise<ApiResponse> {
  return api.post<ApiResponse>("/api/pilot/run-download");
}

/**
 * PILOT - 手动触发清理
 */
export async function triggerCleanup(): Promise<ApiResponse> {
  return api.post<ApiResponse>("/api/pilot/run-cleanup");
}

/**
 * PANEL - 删除种子
 */
export async function deletePanelTorrents(
  data: DeleteTorrentsRequest
): Promise<BackendPanelDeleteTorrentsResponse> {
  return api.post<BackendPanelDeleteTorrentsResponse>(
    "/api/panel/torrents/delete",
    data,
  );
}

/**
 * PANEL - 暂停种子
 */
export async function pausePanelTorrents(
  data: PauseTorrentsRequest
): Promise<BackendPanelPauseTorrentsResponse> {
  return api.post<BackendPanelPauseTorrentsResponse>(
    "/api/panel/torrents/pause",
    data,
  );
}

/**
 * PANEL - 恢复种子
 */
export async function resumePanelTorrents(
  data: ResumeTorrentsRequest
): Promise<BackendPanelResumeTorrentsResponse> {
  return api.post<BackendPanelResumeTorrentsResponse>(
    "/api/panel/torrents/resume",
    data,
  );
}
