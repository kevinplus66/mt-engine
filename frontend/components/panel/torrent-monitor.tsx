/**
 * TorrentMonitor - PANEL 种子监控表
 * 显示当前活跃的种子列表
 * 响应式：移动端卡片、平板精简表格、桌面完整表格
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Trash2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePanelTorrents } from "@/hooks/use-panel-torrents";
import { useSortable } from "@/hooks/use-sortable";
import { sortData, panelTorrentSortExtractors } from "@/lib/sort-utils";
import { useRef, useEffect, useState, useMemo } from "react";
import { autoAnimate } from "@formkit/auto-animate";
import { deletePanelTorrents, pausePanelTorrents, resumePanelTorrents } from "@/lib/api";
import { toast } from "sonner";
import { useIsMobile, useIsTablet } from "@/hooks/use-media-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type StatusFilter = "all" | "downloading" | "seeding" | "paused";
type PanelSortField = "name" | "progress";

export function TorrentMonitor() {
  const { data: torrents, isLoading, error, mutate } = usePanelTorrents();
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [deleteHash, setDeleteHash] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [processingHashes, setProcessingHashes] = useState<Set<string>>(new Set());

  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  // AutoAnimate for table body and card container
  useEffect(() => {
    if (tableBodyRef.current) {
      autoAnimate(tableBodyRef.current);
    }
    if (cardContainerRef.current) {
      autoAnimate(cardContainerRef.current);
    }
  }, []);

  // Sorting state - default to name ascending
  const {
    sortField,
    sortDirection,
    handleSort,
    getSortDirection,
  } = useSortable<PanelSortField>({
    defaultField: "name",
    defaultDirection: "asc",
  });

  const getUserStatusBadge = (status: string) => {
    // 后端返回的状态: downloading, uploading, stalledDL, pausedDL, stoppedDL, etc.
    switch (status) {
      case "uploading":
      case "seeding":
        return (
          <Badge variant="outline" className="text-green-600 border-green-600">
            做种中
          </Badge>
        );
      case "downloading":
      case "leeching":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            下载中
          </Badge>
        );
      case "stalledDL":
        return (
          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
            等待中
          </Badge>
        );
      case "pausedDL":
      case "pausedUP":
      case "stoppedDL":
      case "stoppedUP":
        return (
          <Badge variant="outline" className="text-gray-600 border-gray-600">
            已暂停
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-gray-600">
            {status}
          </Badge>
        );
    }
  };

  const handleDeleteClick = (hash: string, name: string) => {
    setDeleteHash(hash);
    setDeleteName(name);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteHash) return;

    setIsDeleting(true);
    try {
      await deletePanelTorrents({ hashes: [deleteHash], delete_files: true });
      toast.success("种子已删除");
      await mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setIsDeleting(false);
      setDeleteHash(null);
      setDeleteName("");
    }
  };

  const handlePauseClick = async (hash: string, name: string) => {
    setProcessingHashes(prev => new Set(prev).add(hash));
    try {
      const result = await pausePanelTorrents({ hashes: [hash] });
      if (result.success) {
        toast.success(`已暂停: ${name}`);
        // 只更新这一条种子的状态，不重新请求整个列表
        mutate(
          torrents?.map(t =>
            (t.hash || t.id) === hash
              ? { ...t, status: 'stoppedUP' } as any
              : t
          ),
          { revalidate: false }
        );
      } else {
        toast.error(result.error || "暂停失败");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "暂停失败");
    } finally {
      setProcessingHashes(prev => {
        const next = new Set(prev);
        next.delete(hash);
        return next;
      });
    }
  };

  const handleResumeClick = async (hash: string, name: string) => {
    setProcessingHashes(prev => new Set(prev).add(hash));
    try {
      const result = await resumePanelTorrents({ hashes: [hash] });
      if (result.success) {
        toast.success(`已恢复: ${name}`);
        // 只更新这一条种子的状态，不重新请求整个列表
        mutate(
          torrents?.map(t =>
            (t.hash || t.id) === hash
              ? { ...t, status: 'uploading' } as any
              : t
          ),
          { revalidate: false }
        );
      } else {
        toast.error(result.error || "恢复失败");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "恢复失败");
    } finally {
      setProcessingHashes(prev => {
        const next = new Set(prev);
        next.delete(hash);
        return next;
      });
    }
  };

  const isPaused = (status: string) => {
    // qBittorrent v4.x: pausedDL, pausedUP
    // qBittorrent v5.0.0+: stoppedDL, stoppedUP
    return status === "pausedDL" || status === "pausedUP" ||
           status === "stoppedDL" || status === "stoppedUP";
  };

  const getStatusFromState = (state: string): StatusFilter => {
    if (state.includes("downloading") || state === "stalledDL" || state === "metaDL") {
      return "downloading";
    }
    if (state.includes("uploading") || state === "stalledUP" || state === "seeding") {
      return "seeding";
    }
    // qBittorrent v4.x: paused, v5.0.0+: stopped
    if (state.includes("paused") || state.includes("stopped")) {
      return "paused";
    }
    return "all";
  };

  const filteredTorrents = torrents?.filter((torrent) => {
    if (statusFilter === "all") return true;
    const torrentStatus = getStatusFromState((torrent as any).status || "");
    return torrentStatus === statusFilter;
  });

  // Apply sorting to filtered torrents
  const sortedTorrents = useMemo(() => {
    if (!filteredTorrents) return [];
    return sortData(filteredTorrents, sortField, sortDirection, panelTorrentSortExtractors);
  }, [filteredTorrents, sortField, sortDirection]);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const getSizeDisplay = (torrent: any) => {
    // 直接使用 size (bytes) 来格式化，确保有单位
    const sizeBytes = torrent.size;
    if (sizeBytes && sizeBytes > 0) {
      return formatBytes(sizeBytes);
    }

    // 如果没有 size，尝试使用 size_display
    const sizeDisplay = torrent.size_display;
    if (sizeDisplay) {
      const sizeStr = String(sizeDisplay);
      // 如果已经有单位，直接返回
      if (/[A-Za-z]/.test(sizeStr)) {
        return sizeStr;
      }
      // 否则添加 GB 单位
      return `${sizeStr} GB`;
    }

    return "0 B";
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-red-600">
          加载失败：{error.message}
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-muted-foreground">加载种子列表中...</p>
        </CardContent>
      </Card>
    );
  }

  if (!torrents || torrents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>种子监控</CardTitle>
        </CardHeader>
        <CardContent className="p-12 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-semibold mb-2">暂无活跃种子</h3>
          <p className="text-muted-foreground">当前没有正在下载或做种的种子</p>
        </CardContent>
      </Card>
    );
  }

  const statusButtons = [
    { value: "all" as const, label: "全部" },
    { value: "downloading" as const, label: "下载中" },
    { value: "seeding" as const, label: "做种中" },
    { value: "paused" as const, label: "已暂停" },
  ];

  // Mobile View: Cards
  if (isMobile) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">种子监控</CardTitle>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
              {statusButtons.map((btn) => (
                <button
                  key={btn.value}
                  onClick={() => setStatusFilter(btn.value)}
                  className={`px-3 py-1.5 text-sm font-mono border-2 border-black dark:border-white transition-all whitespace-nowrap snap-start ${
                    statusFilter === btn.value
                      ? "bg-black text-white dark:bg-white dark:text-black"
                      : "bg-white text-black dark:bg-zinc-900 dark:text-white"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div ref={cardContainerRef} className="space-y-3">
              {sortedTorrents && sortedTorrents.map((torrent) => (
                <Card
                  key={torrent.hash || torrent.id}
                  className="p-3"
                >
                  {/* Name and Progress */}
                  <div className="mb-3">
                    <h3 className="font-medium text-sm line-clamp-2 leading-snug mb-2">
                      {torrent.name}
                    </h3>
                    <div className="w-full space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold font-mono">
                          {Math.round(((torrent as any).progress || 0) * 100)}%
                        </span>
                        <span className="text-muted-foreground">
                          {getSizeDisplay(torrent)}
                        </span>
                      </div>
                      <div className="w-full h-3 bg-white dark:bg-zinc-900 border-2 border-black dark:border-white overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            ((torrent as any).progress || 0) >= 1
                              ? 'bg-green-500'
                              : isPaused((torrent as any).status)
                              ? 'bg-gray-400'
                              : 'bg-blue-500'
                          }`}
                          style={{ width: `${((torrent as any).progress || 0) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tags and S/L */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex flex-wrap gap-1">
                      {((torrent as any).tags || []).slice(0, 2).map((tag: string) => (
                        <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-green-600 border-green-600">
                        ↑{(torrent as any).seeders || 0}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-blue-600 border-blue-600">
                        ↓{(torrent as any).leechers || 0}
                      </Badge>
                      {isPaused((torrent as any).status) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResumeClick((torrent as any).hash || torrent.id, torrent.name)}
                          disabled={processingHashes.has((torrent as any).hash || torrent.id)}
                          className="h-6 w-6 p-0 ml-4"
                          aria-label="恢复种子"
                        >
                          <Play className="h-3 w-3" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePauseClick((torrent as any).hash || torrent.id, torrent.name)}
                          disabled={processingHashes.has((torrent as any).hash || torrent.id)}
                          className="h-6 w-6 p-0 ml-4"
                          aria-label="暂停种子"
                        >
                          <Pause className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteClick((torrent as any).hash || torrent.id, torrent.name)}
                        disabled={isDeleting}
                        className="h-6 w-6 p-0 ml-1"
                        aria-label="删除种子"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteHash} onOpenChange={(open) => !open && setDeleteHash(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除</AlertDialogTitle>
              <AlertDialogDescription>
                确定要删除种子 <strong>{deleteName}</strong> 吗？
                <br />
                <span className="text-red-600 font-semibold">此操作将删除种子及其文件，无法撤销。</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? "删除中..." : "确认删除"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Tablet View: Condensed Table
  if (isTablet) {
    return (
      <>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>种子监控</CardTitle>
              <div className="flex gap-2">
                {statusButtons.map((btn) => (
                  <button
                    key={btn.value}
                    onClick={() => setStatusFilter(btn.value)}
                    className={`px-3 py-1 text-sm font-mono border-2 border-black dark:border-white transition-all ${
                      statusFilter === btn.value
                        ? "bg-black text-white dark:bg-white dark:text-black"
                        : "bg-white text-black dark:bg-zinc-900 dark:text-white"
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto relative">
              <Table className="w-full min-w-[600px]">
                            <TableHeader>
                              <TableRow>
                                <SortableTableHead
                                  sortKey="name"
                                  sortDirection={getSortDirection("name")}
                                  onSort={(key) => handleSort(key as PanelSortField)}
                                  className="w-auto min-w-[300px]"
                                >
                                  名称
                                </SortableTableHead>
                                <SortableTableHead
                                  sortKey="progress"
                                  sortDirection={getSortDirection("progress")}
                                  onSort={(key) => handleSort(key as PanelSortField)}
                                  className="w-[200px] min-w-[200px] max-w-[200px] sticky right-[90px] bg-black dark:bg-white z-20 shadow-[-1px_0_0_0_rgba(255,255,255,0.1)] dark:shadow-[-1px_0_0_0_rgba(0,0,0,0.1)]"
                                >
                                  进度
                                </SortableTableHead>
                                <TableHead className="w-[90px] min-w-[90px] max-w-[90px] text-right sticky right-0 bg-black dark:bg-white z-20">操作</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody ref={tableBodyRef}>
                              {sortedTorrents && sortedTorrents.map((torrent) => (
                                <TableRow key={torrent.hash || torrent.id}>
                                  <TableCell className="min-w-[300px]">
                                    <div className="font-medium whitespace-nowrap">
                                      {torrent.name}
                                    </div>
                                  </TableCell>
                                  <TableCell className="sticky right-[90px] w-[200px] min-w-[200px] max-w-[200px] bg-white dark:bg-zinc-950 z-10 shadow-[-1px_0_0_0_rgba(0,0,0,0.1)] dark:shadow-[-1px_0_0_0_rgba(255,255,255,0.1)]">
                                    <div className="w-full space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold font-mono">
                                          {Math.round(((torrent as any).progress || 0) * 100)}%
                                        </span>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                                          {getSizeDisplay(torrent)}
                                        </span>
                                      </div>
                                      <div className="w-full h-3 bg-white dark:bg-zinc-900 border-2 border-black dark:border-white overflow-hidden">
                                        <div
                                          className={`h-full transition-all duration-300 ${
                                            ((torrent as any).progress || 0) >= 1
                                              ? 'bg-green-500'
                                              : ((torrent as any).status === 'pausedDL' || (torrent as any).status === 'pausedUP')
                                              ? 'bg-gray-400'
                                              : 'bg-blue-500'
                                          }`}
                                          style={{ width: `${((torrent as any).progress || 0) * 100}%` }}
                                        />
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right sticky right-0 w-[90px] min-w-[90px] max-w-[90px] bg-white dark:bg-zinc-950 z-10">
                                    <div className="flex gap-2 justify-end">                          {isPaused((torrent as any).status) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResumeClick((torrent as any).hash || torrent.id, torrent.name)}
                              disabled={processingHashes.has((torrent as any).hash || torrent.id)}
                              className="h-9 w-9 p-0"
                              aria-label="恢复种子"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePauseClick((torrent as any).hash || torrent.id, torrent.name)}
                              disabled={processingHashes.has((torrent as any).hash || torrent.id)}
                              className="h-9 w-9 p-0"
                              aria-label="暂停种子"
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteClick((torrent as any).hash || torrent.id, torrent.name)}
                            disabled={isDeleting}
                            className="h-9 w-9 p-0"
                            aria-label="删除种子"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteHash} onOpenChange={(open) => !open && setDeleteHash(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除</AlertDialogTitle>
              <AlertDialogDescription>
                确定要删除种子 <strong>{deleteName}</strong> 吗？
                <br />
                <span className="text-red-600 font-semibold">此操作将删除种子及其文件，无法撤销。</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? "删除中..." : "确认删除"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Desktop View: Full Table
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>种子监控</CardTitle>
            <div className="flex gap-2">
              {statusButtons.map((btn) => (
                <button
                  key={btn.value}
                  onClick={() => setStatusFilter(btn.value)}
                  className={`px-3 py-1 text-sm font-mono border-2 border-black dark:border-white transition-all ${
                    statusFilter === btn.value
                      ? "bg-black text-white dark:bg-white dark:text-black"
                      : "bg-white text-black dark:bg-zinc-900 dark:text-white"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
      <CardContent>
        <div className="overflow-x-auto md:overflow-x-visible">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  sortKey="name"
                  sortDirection={getSortDirection("name")}
                  onSort={(key) => handleSort(key as PanelSortField)}
                  className="min-w-[200px]"
                >
                  名称
                </SortableTableHead>
                <TableHead className="w-[120px]">标签</TableHead>
                <TableHead className="w-[120px]">做种/下载</TableHead>
                <SortableTableHead
                  sortKey="progress"
                  sortDirection={getSortDirection("progress")}
                  onSort={(key) => handleSort(key as PanelSortField)}
                  className="w-[220px] pl-6"
                >
                  进度
                </SortableTableHead>
                <TableHead className="w-[100px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody ref={tableBodyRef}>
              {sortedTorrents && sortedTorrents.map((torrent) => (
                <TableRow key={torrent.hash || torrent.id}>
                  <TableCell>
                    <div className="font-medium line-clamp-2 min-w-0">
                      {torrent.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {((torrent as any).tags || []).map((tag: string) => (
                        <Badge key={tag} variant="outline" className="text-[10px] px-1.5 h-5 flex items-center justify-center border-2 border-black dark:border-white bg-white dark:bg-zinc-900 text-black dark:text-white whitespace-nowrap">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1 px-2 h-5 border-2 border-black dark:border-white bg-white dark:bg-zinc-900">
                        <span className="text-green-600 font-bold text-xs">↑</span>
                        <span className="text-[10px] font-mono">{(torrent as any).seeders || 0}</span>
                      </div>
                      <div className="flex items-center gap-1 px-2 h-5 border-2 border-black dark:border-white bg-white dark:bg-zinc-900">
                        <span className="text-blue-600 font-bold text-xs">↓</span>
                        <span className="text-[10px] font-mono">{(torrent as any).leechers || 0}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="pl-6">
                    <div className="w-full space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold font-mono">
                          {Math.round(((torrent as any).progress || 0) * 100)}%
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {getSizeDisplay(torrent)}
                        </span>
                      </div>
                      <div className="w-full h-3 bg-white dark:bg-zinc-900 border-2 border-black dark:border-white overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            ((torrent as any).progress || 0) >= 1
                              ? 'bg-green-500'
                              : isPaused((torrent as any).status)
                              ? 'bg-gray-400'
                              : 'bg-blue-500'
                          }`}
                          style={{ width: `${((torrent as any).progress || 0) * 100}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      {isPaused((torrent as any).status) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResumeClick((torrent as any).hash || torrent.id, torrent.name)}
                          disabled={processingHashes.has((torrent as any).hash || torrent.id)}
                          aria-label="恢复种子"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePauseClick((torrent as any).hash || torrent.id, torrent.name)}
                          disabled={processingHashes.has((torrent as any).hash || torrent.id)}
                          aria-label="暂停种子"
                        >
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteClick((torrent as any).hash || torrent.id, torrent.name)}
                        disabled={isDeleting}
                        aria-label="删除种子"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    {/* Delete Confirmation Dialog */}
    <AlertDialog open={!!deleteHash} onOpenChange={(open) => !open && setDeleteHash(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除</AlertDialogTitle>
          <AlertDialogDescription>
            确定要删除种子 <strong>{deleteName}</strong> 吗？
            <br />
            <span className="text-red-600 font-semibold">此操作将删除种子及其文件，无法撤销。</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteConfirm}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? "删除中..." : "确认删除"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
