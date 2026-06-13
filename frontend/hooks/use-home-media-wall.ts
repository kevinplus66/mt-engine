"use client";

import useSWR from "swr";
import { getHomeMediaWall } from "@/lib/api";
import type { MediaWallResponse } from "@/lib/types";

export function useHomeMediaWall() {
  return useSWR<MediaWallResponse>("/api/home/media-wall", getHomeMediaWall, {
    refreshInterval: 600000,
    revalidateOnFocus: false,
  });
}
