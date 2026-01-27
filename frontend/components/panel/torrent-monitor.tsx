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
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePanelTorrents } from "@/hooks/use-panel-torrents";
import { useRef, useEffect, useState } from "react";
import { autoAnimate } from "@formkit/auto-animate";
import { deletePanelTorrents } from "@/lib/api";
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

export function TorrentMonitor() {
  const { data: torrents, isLoading, error, mutate } = usePanelTorrents();
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [deleteHash, setDeleteHash] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);

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

  const getUserStatusBadge = (status: string) => {
    // 后端返回的状态: downloading, uploading, stalledDL, pausedDL, etc.
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

  const getStatusFromState = (state: string): StatusFilter => {
    if (state.includes("downloading") || state === "stalledDL" || state === "metaDL") {
      return "downloading";
    }
    if (state.includes("uploading") || state === "stalledUP" || state === "seeding") {
      return "seeding";
    }
    if (state.includes("paused")) {
      return "paused";
    }
    return "all";
  };

  const filteredTorrents = torrents?.filter((torrent) => {
    if (statusFilter === "all") return true;
    const torrentStatus = getStatusFromState((torrent as any).status || "");
    return torrentStatus === statusFilter;
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
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
              {filteredTorrents && filteredTorrents.map((torrent) => (
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
                          {Math.round(((torrent as any).progress || 0) * 100).toFixed(1)}%
                        </span>
                        <span className="text-muted-foreground">
                          {torrent.size_display || formatBytes(torrent.size)}
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
                    <div className="flex gap-1">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-green-600 border-green-600">
                        ↑{(torrent as any).seeders || 0}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-blue-600 border-blue-600">
                        ↓{(torrent as any).leechers || 0}
                      </Badge>
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">名称</TableHead>
                    <TableHead className="w-[150px]">进度</TableHead>
                    <TableHead className="w-[80px] text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody ref={tableBodyRef}>
                  {filteredTorrents && filteredTorrents.map((torrent) => (
                    <TableRow key={torrent.hash || torrent.id}>
                      <TableCell>
                        <div className="font-medium line-clamp-2 min-w-0">
                          {torrent.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="w-full space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold font-mono">
                              {Math.round(((torrent as any).progress || 0) * 100).toFixed(1)}%
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
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteClick((torrent as any).hash || torrent.id, torrent.name)}
                          disabled={isDeleting}
                          className="h-9"
                          aria-label="删除种子"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
                <TableHead className="min-w-[200px]">名称</TableHead>
                <TableHead className="w-[100px]">标签</TableHead>
                <TableHead className="w-[120px]">做种/下载</TableHead>
                <TableHead className="w-[180px]">进度</TableHead>
                <TableHead className="w-[80px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody ref={tableBodyRef}>
              {filteredTorrents && filteredTorrents.map((torrent) => (
                <TableRow key={torrent.hash || torrent.id}>
                  <TableCell>
                    <div className="font-medium line-clamp-2 min-w-0">
                      {torrent.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {((torrent as any).tags || []).map((tag: string) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1 px-2 py-1 border-2 border-black dark:border-white bg-white dark:bg-zinc-900">
                        <span className="text-green-600 font-bold">↑</span>
                        <span className="text-sm font-mono">{(torrent as any).seeders || 0}</span>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-1 border-2 border-black dark:border-white bg-white dark:bg-zinc-900">
                        <span className="text-blue-600 font-bold">↓</span>
                        <span className="text-sm font-mono">{(torrent as any).leechers || 0}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="w-full space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold font-mono">
                          {Math.round(((torrent as any).progress || 0) * 100).toFixed(1)}%
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {torrent.size_display || formatBytes(torrent.size)}
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
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteClick((torrent as any).hash || torrent.id, torrent.name)}
                      disabled={isDeleting}
                      aria-label="删除种子"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
