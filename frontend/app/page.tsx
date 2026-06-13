"use client";

import { Clapperboard, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageScaffold } from "@/components/common/page-scaffold";
import {
  EmptyMediaWall,
  HomeMediaWall,
  HomeMediaWallLoading,
} from "@/components/home/media-wall";
import { StateCard } from "@/components/common/state-card";
import { useHomeMediaWall } from "@/hooks/use-home-media-wall";

export default function Home() {
  const { data, error, isLoading, mutate, isValidating } = useHomeMediaWall();
  const hasItems = data?.rails.some((rail) => rail.items.length > 0) ?? false;

  return (
    <PageScaffold
      eyebrow="HOME"
      title="家庭 4K 媒体雷达"
      description="从 M-Team 缓存里整理英美剧、外语电影、日韩剧、华语剧集和经典 4K 收藏。"
      icon={Clapperboard}
      actions={
        <Button
          variant="outline"
          onClick={() => mutate()}
          loading={isValidating}
          aria-label="刷新媒体墙视图"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          刷新视图
        </Button>
      }
    >
      {isLoading && <HomeMediaWallLoading />}
      {error && (
        <StateCard
          icon={Clapperboard}
          title="加载媒体墙失败"
          description={error.message || "请检查前后端连接。"}
        />
      )}
      {data && (hasItems ? <HomeMediaWall data={data} /> : <EmptyMediaWall />)}
    </PageScaffold>
  );
}
