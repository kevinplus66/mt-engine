import { SegmentedControl } from "@/components/common/segmented-control";
import type { SearchMode } from "@/lib/types";

interface ModeTabsProps {
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
}

export function ModeTabs({ mode, onModeChange }: ModeTabsProps) {
  const options = [
    { value: "normal" as const, label: "综合" },
    { value: "movie" as const, label: "电影" },
    { value: "tvshow" as const, label: "电视剧" },
    { value: "other" as const, label: "其他" },
    { value: "adult" as const, label: "成人", className: "text-destructive" },
  ];

  return (
    <SegmentedControl
      ariaLabel="搜索模式"
      className="w-full"
      itemClassName="min-w-0 flex-1"
      fullWidth
      value={mode}
      options={options}
      onValueChange={onModeChange}
    />
  );
}
