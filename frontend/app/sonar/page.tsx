"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Search } from "lucide-react";
import { StatusTabs } from "@/components/sonar/status-tabs";
import { FilterPills, type SizeFilter, type SeederFilter } from "@/components/sonar/filter-pills";
import { DropdownFilters, type RemainingFilter, type ModeFilter } from "@/components/sonar/dropdown-filters";
import { AutoDeleteToggle } from "@/components/sonar/auto-delete-toggle";
import { TorrentList } from "@/components/sonar/torrent-list";
import { PageTransition } from "@/components/common/page-transition";
import { useSonarTorrents } from "@/hooks/use-sonar-torrents";
import { refreshTorrents } from "@/lib/api";
import { toast } from "sonner";
import type { Torrent } from "@/lib/types";

type UserStatus = "all" | "seeding" | "leeching" | "none";

export default function SonarPage() {
  const { data: torrents, isLoading, error, mutate } = useSonarTorrents();
  const [statusFilter, setStatusFilter] = useState<UserStatus>("all");
  const [sizeFilter, setSizeFilter] = useState<SizeFilter>("all");
  const [seederFilter, setSeederFilter] = useState<SeederFilter>("all");
  const [remainingFilter, setRemainingFilter] = useState<RemainingFilter>("all");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshTorrents();
      await mutate();
      toast.success("刷新成功");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "刷新失败");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleReset = () => {
    setSearchKeyword("");
    setSizeFilter("all");
    setSeederFilter("all");
    setRemainingFilter("all");
    setModeFilter("all");
  };

  // 过滤逻辑
  const filteredTorrents = torrents?.filter((torrent: Torrent) => {
    // 状态过滤
    if (statusFilter !== "all" && torrent.user_status !== statusFilter) {
      return false;
    }

    // 关键词搜索
    if (searchKeyword && !torrent.name.toLowerCase().includes(searchKeyword.toLowerCase())) {
      return false;
    }

    // 大小过滤
    const sizeGB = torrent.size / (1024 ** 3);
    if (sizeFilter === "small" && sizeGB >= 10) return false;
    if (sizeFilter === "medium" && (sizeGB < 10 || sizeGB >= 50)) return false;
    if (sizeFilter === "large" && (sizeGB < 50 || sizeGB >= 100)) return false;
    if (sizeFilter === "xlarge" && sizeGB < 100) return false;

    // 做种数过滤
    if (seederFilter === "hot" && torrent.seeders <= 10) return false;
    if (seederFilter === "normal" && (torrent.seeders < 5 || torrent.seeders > 10)) return false;
    if (seederFilter === "rare" && (torrent.seeders < 1 || torrent.seeders > 5)) return false;
    if (seederFilter === "dead" && torrent.seeders !== 0) return false;

    // 剩余时间过滤
    if (remainingFilter !== "all" && torrent.remaining) {
      const hours = torrent.remaining.hours || 0;
      if (remainingFilter === "critical" && hours >= 1) return false;
      if (remainingFilter === "danger" && (hours < 1 || hours >= 2)) return false;
      if (remainingFilter === "warning" && (hours < 2 || hours >= 6)) return false;
      if (remainingFilter === "safe" && (hours < 6 || hours >= 24)) return false;
      if (remainingFilter === "plenty" && hours < 24) return false;
    }

    // 频道过滤
    if (modeFilter === "normal" && torrent.mode === "adult") return false;
    if (modeFilter === "adult" && torrent.mode !== "adult") return false;

    return true;
  });

  return (
    <PageTransition>
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="mx-auto max-w-[95%] space-y-6">
        {/* 标题 */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">SONAR</h1>
            <p className="text-muted-foreground">免费种子监控</p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            variant="outline"
            className="w-full sm:w-auto min-h-[44px]"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            手动刷新
          </Button>
        </div>

        {/* 控制栏 */}
        <Card className="p-6 space-y-4">
          {/* 第一行：搜索栏 */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                name="search"
                autoComplete="off"
                placeholder="搜索种子名称..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" onClick={handleReset}>
              重置
            </Button>
          </div>

          {/* 第二行：状态标签 */}
          <div className="flex items-center justify-between">
            <StatusTabs status={statusFilter} onStatusChange={setStatusFilter} />
            <AutoDeleteToggle />
          </div>

          {/* 第三行：快速过滤按钮 */}
          <FilterPills
            sizeFilter={sizeFilter}
            seederFilter={seederFilter}
            onSizeChange={setSizeFilter}
            onSeederChange={setSeederFilter}
          />

          {/* 第四行：下拉过滤器 */}
          <DropdownFilters
            remainingFilter={remainingFilter}
            modeFilter={modeFilter}
            onRemainingChange={setRemainingFilter}
            onModeChange={setModeFilter}
          />

          {/* 统计信息 */}
          {torrents && (
            <div className="text-sm text-muted-foreground">
              共 <strong>{filteredTorrents?.length || 0}</strong> 个种子
              {filteredTorrents?.length !== torrents.length && (
                <span className="ml-2">
                  （筛选自 {torrents.length} 个）
                </span>
              )}
            </div>
          )}
        </Card>

        {/* 种子列表 */}
        {error && (
          <Card className="p-6 text-center text-red-600">
            加载失败：{error.message}
          </Card>
        )}

        {isLoading && (
          <Card className="p-12 text-center">
            <div className="text-6xl mb-4">⏳</div>
            <p className="text-muted-foreground">加载中...</p>
          </Card>
        )}

        {!isLoading && !error && filteredTorrents && (
          <TorrentList torrents={filteredTorrents} />
        )}

        {!isLoading && !error && filteredTorrents?.length === 0 && (
          <Card className="p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-xl font-semibold mb-2">暂无种子</h3>
            <p className="text-muted-foreground">
              {statusFilter === "all"
                ? "当前没有免费种子"
                : "当前筛选条件下没有种子"}
            </p>
          </Card>
        )}
        </div>
      </div>
    </PageTransition>
  );
}
