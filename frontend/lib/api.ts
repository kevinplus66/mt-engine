/**
 * MT-Engine API Client
 * 封装 fetch 请求，提供统一的错误处理
 */

import { CONFIG } from "./constants";
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

/**
 * 基础 fetcher 函数，用于 SWR
 */
export async function fetcher<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: response.statusText,
    }));
    throw new ApiError(
      response.status,
      error.message || `HTTP ${response.status}`
    );
  }

  return response.json();
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
  PilotStats,
  PanelStats,
  AutoDeleteStatus,
  Torrent,
  FilterOptions,
} from "./types";

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
  return api.post<DownloadResponse>("/api/radar/download", request);
}

/**
 * RADAR - 获取筛选选项
 */
export async function getFilterOptions(): Promise<FilterOptions> {
  return api.get<FilterOptions>("/api/filter-options");
}

/**
 * SONAR - 获取免费种子列表
 */
export async function getFreeTorrents(): Promise<Torrent[]> {
  return api.get<Torrent[]>("/api/torrents");
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
  return api.post<DownloadResponse>("/api/download", request);
}

/**
 * SONAR - 切换自动删除
 */
export async function toggleAutoDelete(
  enabled: boolean
): Promise<AutoDeleteStatus> {
  return api.post<AutoDeleteStatus>("/api/auto-delete/toggle", { enabled });
}

/**
 * SONAR - 获取自动删除状态
 */
export async function getAutoDeleteStatus(): Promise<AutoDeleteStatus> {
  return api.get<AutoDeleteStatus>("/api/auto-delete/status");
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
 * PILOT - 获取统计数据
 */
export async function getPilotStats(): Promise<PilotStats> {
  return api.get<PilotStats>("/api/pilot/stats");
}

/**
 * PILOT - 模拟运行
 */
export async function dryRunPilot(): Promise<any> {
  return api.get("/api/pilot/dry-run");
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
 * PANEL - 获取统计数据
 */
export async function getPanelStats(): Promise<PanelStats> {
  return api.get<PanelStats>("/api/panel/stats");
}

/**
 * PANEL - 获取历史数据
 */
export async function getPanelHistory(range: string): Promise<unknown> {
  return api.get(`/api/panel/history?range=${range}`);
}

/**
 * PANEL - 获取分享率历史数据
 */
export async function getPanelShareRatio(range: string): Promise<unknown> {
  return api.get(`/api/panel/share-ratio?range=${range}`);
}

/**
 * PANEL - 获取种子列表
 */
export async function getPanelTorrents(): Promise<Torrent[]> {
  return api.get<Torrent[]>("/api/panel/torrents");
}

/**
 * PANEL - 删除种子
 */
export async function deletePanelTorrents(data: {
  hashes: string[];
  delete_files: boolean;
}): Promise<ApiResponse> {
  return api.post<ApiResponse>("/api/panel/torrents/delete", data);
}

/**
 * PANEL - 暂停种子
 */
export async function pausePanelTorrents(data: {
  hashes: string[];
}): Promise<ApiResponse> {
  return api.post<ApiResponse>("/api/panel/torrents/pause", data);
}

/**
 * PANEL - 恢复种子
 */
export async function resumePanelTorrents(data: {
  hashes: string[];
}): Promise<ApiResponse> {
  return api.post<ApiResponse>("/api/panel/torrents/resume", data);
}
