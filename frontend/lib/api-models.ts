import type { components } from "@/lib/api/generated";

export type BackendPanelDataPoint =
  components["schemas"]["PanelTrafficDataPoint"];
export type BackendPanelHistoryResponse =
  components["schemas"]["PanelHistoryResponse"];
export type BackendPanelShareRatioResponse =
  components["schemas"]["PanelShareRatioResponse"];
export type BackendPanelStatsResponse =
  components["schemas"]["PanelStatsResponse"];
export type BackendPanelTorrentsResponse =
  components["schemas"]["PanelTorrentsResponse"];
export type BackendPanelDeleteTorrentsResponse =
  components["schemas"]["PanelDeleteTorrentsResponse"];
export type BackendPanelPauseTorrentsResponse =
  components["schemas"]["PanelPauseTorrentsResponse"];
export type BackendPanelResumeTorrentsResponse =
  components["schemas"]["PanelResumeTorrentsResponse"];
