"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function scheduleDeferredOpen(callback: () => void): number {
  if (typeof window !== "undefined" && window.requestAnimationFrame) {
    return window.requestAnimationFrame(callback);
  }

  return globalThis.setTimeout(callback, 16) as unknown as number;
}

function cancelDeferredOpen(handle: number) {
  if (typeof window !== "undefined" && window.cancelAnimationFrame) {
    window.cancelAnimationFrame(handle);
  }

  globalThis.clearTimeout(handle);
}

export function useDeferredSheetState<T>() {
  const [item, setItem] = useState<T | null>(null);
  const [open, setOpenState] = useState(false);
  const openFrameRef = useRef<number | null>(null);

  const cancelPendingOpen = useCallback(() => {
    if (openFrameRef.current === null) return;
    cancelDeferredOpen(openFrameRef.current);
    openFrameRef.current = null;
  }, []);

  const openWithItem = useCallback(
    (nextItem: T) => {
      cancelPendingOpen();
      setItem(nextItem);
      setOpenState(false);
      openFrameRef.current = scheduleDeferredOpen(() => {
        openFrameRef.current = null;
        setOpenState(true);
      });
    },
    [cancelPendingOpen],
  );

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) cancelPendingOpen();
      setOpenState(nextOpen);
    },
    [cancelPendingOpen],
  );

  const reset = useCallback(() => {
    cancelPendingOpen();
    setOpenState(false);
    setItem(null);
  }, [cancelPendingOpen]);

  const handleOpenChangeComplete = useCallback((nextOpen: boolean) => {
    if (!nextOpen) setItem(null);
  }, []);

  useEffect(() => cancelPendingOpen, [cancelPendingOpen]);

  return {
    item,
    open,
    openWithItem,
    setOpen,
    reset,
    handleOpenChangeComplete,
  } as const;
}
