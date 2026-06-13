"use client";

import { SegmentedControl } from "@/components/common/segmented-control";
import {
  PANEL_TIME_RANGE_OPTIONS,
  type PanelTimeRange,
} from "@/lib/panel-view";

interface PanelRangeControlProps {
  value: PanelTimeRange;
  onValueChange: (value: PanelTimeRange) => void;
  ariaLabel?: string;
}

export function PanelRangeControl({
  value,
  onValueChange,
  ariaLabel = "趋势窗口时间范围",
}: PanelRangeControlProps) {
  return (
    <SegmentedControl
      ariaLabel={ariaLabel}
      value={value}
      options={PANEL_TIME_RANGE_OPTIONS}
      onValueChange={onValueChange}
    />
  );
}
