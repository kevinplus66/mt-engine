import { cleanup, render, screen } from "@testing-library/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PilotPage from "@/app/pilot/page";
import PanelPage from "@/app/panel/page";

const mocks = vi.hoisted(() => ({
  usePilotConfig: vi.fn(),
  usePilotStats: vi.fn(),
  usePilotConfigEditor: vi.fn(),
  usePilotActions: vi.fn(),
  usePanelStats: vi.fn(),
  usePanelTimeRangeQuery: vi.fn(),
  usePanelTorrents: vi.fn(),
  usePanelMonitorQuery: vi.fn(),
  usePanelTorrentActions: vi.fn(),
  useIsMobile: vi.fn(),
  useAutoAnimateList: vi.fn(),
}));

vi.mock("next/dynamic", () => ({
  default: (
    loader: () => Promise<unknown>,
    options?: { loading?: () => ReactNode },
  ) => {
    const source = String(loader);
    if (source.includes("share-ratio-chart")) {
      function ShareRatioChartMock() {
        return <section aria-label="share-ratio-chart" />;
      }
      return ShareRatioChartMock;
    }
    if (source.includes("traffic-chart")) {
      function TrafficChartMock() {
        return <section aria-label="traffic-chart" />;
      }
      return TrafficChartMock;
    }

    function DynamicFallbackMock() {
      return options?.loading ? options.loading() : null;
    }
    return DynamicFallbackMock;
  },
}));

afterEach(() => {
  cleanup();
});

vi.mock("@/hooks/use-pilot-config", () => ({
  usePilotConfig: mocks.usePilotConfig,
}));

vi.mock("@/hooks/use-pilot-stats", () => ({
  usePilotStats: mocks.usePilotStats,
}));

vi.mock("@/hooks/use-pilot-config-editor", () => ({
  usePilotConfigEditor: mocks.usePilotConfigEditor,
}));

vi.mock("@/hooks/use-pilot-actions", () => ({
  usePilotActions: mocks.usePilotActions,
}));

vi.mock("@/hooks/use-panel-stats", () => ({
  usePanelStats: mocks.usePanelStats,
}));

vi.mock("@/hooks/use-panel-time-range-query", () => ({
  usePanelTimeRangeQuery: mocks.usePanelTimeRangeQuery,
}));

vi.mock("@/hooks/use-panel-torrents", () => ({
  usePanelTorrents: mocks.usePanelTorrents,
}));

vi.mock("@/hooks/use-panel-monitor-query", () => ({
  usePanelMonitorQuery: mocks.usePanelMonitorQuery,
}));

vi.mock("@/hooks/use-panel-torrent-actions", () => ({
  usePanelTorrentActions: mocks.usePanelTorrentActions,
}));

vi.mock("@/hooks/use-media-query", () => ({
  useIsMobile: mocks.useIsMobile,
}));

vi.mock("@/hooks/use-auto-animate-list", () => ({
  useAutoAnimateList: mocks.useAutoAnimateList,
}));

vi.mock("@/components/common/page-scaffold", () => ({
  PageScaffold: ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  ),
}));

vi.mock("@/components/common/state-card", () => ({
  StateCard: ({ title, description }: { title: string; description?: string }) => (
    <section role="status">
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </section>
  ),
  MessageCard: ({ children }: { children: ReactNode }) => (
    <section>{children}</section>
  ),
}));

vi.mock("@/components/common/section-card", () => ({
  SectionCard: ({
    title,
    action,
    children,
  }: {
    title: string;
    action?: ReactNode;
    children?: ReactNode;
  }) => (
    <section aria-label={title}>
      {action}
      {children}
    </section>
  ),
}));

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: { children: ReactNode }) => (
    <div role="alert">{children}</div>
  ),
  AlertDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  AlertTitle: ({ children }: { children: ReactNode }) => (
    <h2>{children}</h2>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    loading,
    variant,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean;
    variant?: string;
  }) => (
    <button
      data-loading={loading ? "true" : undefined}
      data-variant={variant}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogClose: ({
    children,
    render,
  }: {
    children: ReactNode;
    render?: ReactNode;
  }) => render ?? <button>{children}</button>,
  AlertDialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  AlertDialogFooter: ({ children }: { children: ReactNode }) => (
    <footer>{children}</footer>
  ),
  AlertDialogHeader: ({ children }: { children: ReactNode }) => (
    <header>{children}</header>
  ),
  AlertDialogTitle: ({ children }: { children: ReactNode }) => (
    <h2>{children}</h2>
  ),
}));

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({ children }: { children: ReactNode }) => <td>{children}</td>,
  TableHead: ({ children }: { children: ReactNode }) => <th>{children}</th>,
  TableHeader: ({ children }: { children: ReactNode }) => (
    <thead>{children}</thead>
  ),
  TableRow: ({ children }: { children: ReactNode }) => <tr>{children}</tr>,
}));

vi.mock("@/components/ui/sortable-table-head", () => ({
  SortableTableHead: ({ children }: { children: ReactNode }) => (
    <th>{children}</th>
  ),
}));

vi.mock("@/components/common/segmented-control", () => ({
  SegmentedControl: ({ ariaLabel }: { ariaLabel: string }) => (
    <div aria-label={ariaLabel} />
  ),
  MultiSegmentedControl: ({ ariaLabel }: { ariaLabel: string }) => (
    <div aria-label={ariaLabel} />
  ),
}));

vi.mock("@/components/common/simple-pagination", () => ({
  SimplePagination: () => <nav aria-label="pagination" />,
}));

vi.mock("@/components/common/torrent-table-parts", () => ({
  StickyActionCell: ({ children }: { children: ReactNode }) => <td>{children}</td>,
  StickyActionHead: () => <th />,
  TorrentNameCell: ({
    name,
    badges,
  }: {
    name: string;
    badges?: ReactNode;
  }) => (
    <div>
      <span>{name}</span>
      {badges}
    </div>
  ),
  TorrentPeerBadges: ({
    seeders,
    leechers,
  }: {
    seeders?: number;
    leechers?: number;
  }) => (
    <span>
      {seeders}/{leechers}
    </span>
  ),
}));

vi.mock("@/components/panel/torrent-progress-block", () => ({
  TorrentProgressBlock: () => <div aria-label="torrent-progress" />,
}));

vi.mock("@/components/pilot/config-form", () => ({
  ConfigForm: () => (
    <section aria-label="pilot-config-form">
      <textarea aria-label="editable config" defaultValue="editable" />
    </section>
  ),
}));

vi.mock("@/components/pilot/control-bar", () => ({
  ControlBar: () => <section aria-label="pilot-control-bar" />,
}));

vi.mock("@/components/pilot/dry-run-results", () => ({
  DryRunResults: () => <section aria-label="dry-run-results" />,
}));

vi.mock("@/components/pilot/stats-bar", () => ({
  StatsBar: () => <section aria-label="pilot-stats-bar" />,
}));

vi.mock("@/components/panel/share-ratio-chart", () => ({
  ShareRatioChart: () => <section aria-label="share-ratio-chart" />,
}));

vi.mock("@/components/panel/stats-grid", () => ({
  StatsGrid: () => <section aria-label="panel-stats-grid" />,
}));

vi.mock("@/components/panel/torrent-monitor", () => ({
  TorrentMonitor: () => <section aria-label="torrent-monitor" />,
}));

vi.mock("@/components/panel/traffic-chart", () => ({
  TrafficChart: () => <section aria-label="traffic-chart" />,
}));

const config = {
  download: { enabled: true },
  cleanup: { enabled: false },
};

function mockPilotEditor() {
  mocks.usePilotConfigEditor.mockReturnValue({
    editedConfig: config,
    validationErrors: {},
    configSections: [],
    setConfigSections: vi.fn(),
    isSaving: false,
    handleConfigChange: vi.fn(),
    handleSave: vi.fn(),
    handleReset: vi.fn(),
    handleDownloadToggle: vi.fn(),
    handleCleanupToggle: vi.fn(),
  });
}

function mockPilotActions() {
  mocks.usePilotActions.mockReturnValue({
    dryRunResult: null,
    setDryRunResult: vi.fn(),
    isDryRunning: false,
    isDownloading: false,
    isCleaning: false,
    handleDryRun: vi.fn(),
    handleDownload: vi.fn(),
    handleCleanup: vi.fn(),
  });
}

function mockPanelMonitorState() {
  mocks.usePanelMonitorQuery.mockReturnValue({
    statusFilter: "all",
    setStatusFilter: vi.fn(),
    page: 1,
    setPage: vi.fn(),
  });
  mocks.usePanelTorrentActions.mockReturnValue({
    deleteTarget: null,
    isDeleting: false,
    processingHashes: new Set<string>(),
    requestDelete: vi.fn(),
    closeDelete: vi.fn(),
    confirmDelete: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  });
  mocks.useIsMobile.mockReturnValue(false);
  mocks.useAutoAnimateList.mockReturnValue(undefined);
}

describe("PILOT page loading boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.usePilotConfig.mockReturnValue({
      data: config,
      isLoading: false,
      error: undefined,
      saveConfig: vi.fn(),
    });
    mockPilotEditor();
    mockPilotActions();
  });

  it.each([
    ["pending", { data: undefined, isLoading: true, error: undefined }],
    [
      "error",
      {
        data: undefined,
        isLoading: false,
        error: new Error("stats request failed"),
      },
    ],
  ])("keeps the config editor editable while stats are %s", (_name, statsState) => {
    mocks.usePilotStats.mockReturnValue(statsState);

    render(<PilotPage />);

    expect(screen.getByLabelText("pilot-config-form")).toBeTruthy();
    expect(screen.getByLabelText("editable config")).toBeTruthy();
    expect(screen.getByLabelText("pilot-control-bar")).toBeTruthy();
  });

  it("shows a stats-specific alert when stats fail", () => {
    mocks.usePilotStats.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("stats request failed"),
    });

    render(<PilotPage />);

    expect(screen.getByText("运行统计加载失败")).toBeTruthy();
    expect(screen.getByText("stats request failed")).toBeTruthy();
    expect(screen.queryByText("配置加载失败")).toBeNull();
  });
});

describe("PANEL page loading boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.usePanelTimeRangeQuery.mockReturnValue({
      timeRange: "24h",
      setPanelTimeRange: vi.fn(),
    });
  });

  it("mounts chart and monitor sections while stats are pending", () => {
    mocks.usePanelStats.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: undefined,
    });

    render(<PanelPage />);

    expect(screen.getByLabelText("traffic-chart")).toBeTruthy();
    expect(screen.getByLabelText("share-ratio-chart")).toBeTruthy();
    expect(screen.getByLabelText("torrent-monitor")).toBeTruthy();
    expect(screen.queryByLabelText("panel-stats-grid")).toBeNull();
  });
});

describe("PANEL torrent monitor refresh errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPanelMonitorState();
  });

  it("keeps cached torrents visible when a refresh fails", async () => {
    const { TorrentMonitor } = await vi.importActual<
      typeof import("@/components/panel/torrent-monitor")
    >("@/components/panel/torrent-monitor");

    mocks.usePanelTorrents.mockReturnValue({
      data: [
        {
          hash: "cached-hash",
          id: "cached-id",
          name: "cached torrent",
          progress: 0.42,
          seeders: 2,
          leechers: 1,
          status: "downloading",
          tags: ["cached"],
        },
      ],
      isLoading: false,
      error: new Error("refresh failed"),
      mutate: vi.fn(),
    });

    render(<TorrentMonitor />);

    expect(screen.getByText("cached torrent")).toBeTruthy();
    expect(screen.getByText("种子列表刷新失败")).toBeTruthy();
    expect(screen.getByText("refresh failed")).toBeTruthy();
    expect(screen.queryByText("加载失败：refresh failed")).toBeNull();
  });
});
