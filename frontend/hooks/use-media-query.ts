"use client";

import { useSyncExternalStore } from "react";

const IS_MOBILE_MEDIA_QUERY = "(max-width: 767px)";

function getServerSnapshot(): boolean {
  return false;
}

function subscribeToIsMobile(callback: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mediaQueryList = window.matchMedia(IS_MOBILE_MEDIA_QUERY);
  mediaQueryList.addEventListener("change", callback);
  return () => mediaQueryList.removeEventListener("change", callback);
}

function getIsMobileSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(IS_MOBILE_MEDIA_QUERY).matches;
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribeToIsMobile,
    getIsMobileSnapshot,
    getServerSnapshot,
  );
}
