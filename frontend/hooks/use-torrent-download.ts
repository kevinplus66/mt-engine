import { useState } from "react";
import { toast } from "@/lib/toast";

export function useTorrentDownload(
  download: (torrentId: string) => Promise<{ success?: boolean; message?: string } | void>
) {
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

  const downloadTorrent = async (torrentId: string) => {
    if (downloadingIds.has(torrentId)) return;

    setDownloadingIds((prev) => new Set(prev).add(torrentId));
    try {
      await download(torrentId);
      toast.success("种子已添加到下载队列");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "下载失败");
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(torrentId);
        return next;
      });
    }
  };

  return {
    downloadingIds,
    downloadTorrent,
  };
}
