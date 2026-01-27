/**
 * ModeTabs - 搜索模式切换标签
 * 综合、电影、电视剧、其他、成人
 */

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SearchMode } from "@/lib/types";

interface ModeTabsProps {
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
}

export function ModeTabs({ mode, onModeChange }: ModeTabsProps) {
  return (
    <Tabs value={mode} onValueChange={(v) => onModeChange(v as SearchMode)}>
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="normal">综合</TabsTrigger>
        <TabsTrigger value="movie">电影</TabsTrigger>
        <TabsTrigger value="tvshow">电视剧</TabsTrigger>
        <TabsTrigger value="other">其他</TabsTrigger>
        <TabsTrigger value="adult" className="text-red-500">
          成人
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
