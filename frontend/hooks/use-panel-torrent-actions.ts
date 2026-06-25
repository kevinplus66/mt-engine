"use client";

import { useState } from "react";
import type { KeyedMutator } from "swr";
import { toast } from "@/lib/toast";
import {
  deletePanelTorrents,
  pausePanelTorrents,
  resumePanelTorrents,
} from "@/lib/api";
import type { PanelTorrent } from "@/lib/panel-torrents";

interface DeleteTarget {
  hash: string;
  name: string;
}

export function usePanelTorrentActions(
  torrents: PanelTorrent[] | undefined,
  mutate: KeyedMutator<PanelTorrent[]>,
) {
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [processingHashes, setProcessingHashes] = useState<Set<string>>(
    new Set(),
  );

  const requestDelete = (hash: string, name: string) => {
    setDeleteTarget({ hash, name });
  };

  const closeDelete = () => {
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const result = await deletePanelTorrents({
        hashes: [deleteTarget.hash],
        delete_files: true,
      });
      if (result.success) {
        toast.success("种子已删除");
        setDeleteTarget(null);
        await mutate();
      } else {
        toast.error(result.error || "删除失败");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setIsDeleting(false);
    }
  };

  const pause = async (hash: string, name: string) => {
    setProcessingHashes((prev) => new Set(prev).add(hash));
    try {
      const result = await pausePanelTorrents({ hashes: [hash] });
      if (result.success) {
        toast.success(`已暂停: ${name}`);
        mutate(
          torrents?.map((torrent) =>
            (torrent.hash || torrent.id) === hash
              ? { ...torrent, status: "stoppedUP" }
              : torrent,
          ),
          { revalidate: false },
        );
      } else {
        toast.error(result.error || "暂停失败");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "暂停失败");
    } finally {
      setProcessingHashes((prev) => {
        const next = new Set(prev);
        next.delete(hash);
        return next;
      });
    }
  };

  const resume = async (hash: string, name: string) => {
    setProcessingHashes((prev) => new Set(prev).add(hash));
    try {
      const result = await resumePanelTorrents({ hashes: [hash] });
      if (result.success) {
        toast.success(`已恢复: ${name}`);
        mutate(
          torrents?.map((torrent) =>
            (torrent.hash || torrent.id) === hash
              ? { ...torrent, status: "uploading" }
              : torrent,
          ),
          { revalidate: false },
        );
      } else {
        toast.error(result.error || "恢复失败");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "恢复失败");
    } finally {
      setProcessingHashes((prev) => {
        const next = new Set(prev);
        next.delete(hash);
        return next;
      });
    }
  };

  return {
    deleteTarget,
    isDeleting,
    processingHashes,
    requestDelete,
    closeDelete,
    confirmDelete,
    pause,
    resume,
  };
}
