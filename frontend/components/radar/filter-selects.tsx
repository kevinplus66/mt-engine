/**
 * FilterSelects - 技术筛选下拉框组
 * 包括：清晰度、视频编码、音频编码、国家/地区、优惠
 * 根据搜索模式显示不同的筛选项
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FILTER_CONFIG, FILTER_OPTIONS } from "@/lib/constants";
import type { SearchMode } from "@/lib/types";

interface FilterSelectsProps {
  mode: SearchMode;
  filters: {
    standards: number[];
    videoCodecs: number[];
    audioCodecs: number[];
    sources: number[];
    countries: number[];
    discount: string;
  };
  onFiltersChange: (filters: FilterSelectsProps["filters"]) => void;
}

export function FilterSelects({
  mode,
  filters,
  onFiltersChange,
}: FilterSelectsProps) {
  const visibleFilters = FILTER_CONFIG[mode] || [];

  if (visibleFilters.length === 0) {
    return null;
  }

  const handleDiscountChange = (value: string) => {
    onFiltersChange({ ...filters, discount: value === "all" ? "" : value });
  };

  return (
    <div className="flex flex-wrap gap-3">
      {/* 优惠筛选 - 所有模式都显示 */}
      {visibleFilters.includes("discount") && (
        <Select value={filters.discount || "all"} onValueChange={handleDiscountChange}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="优惠" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部优惠</SelectItem>
            {FILTER_OPTIONS.discounts.map((discount) => (
              <SelectItem key={discount.id} value={discount.id}>
                {discount.name_zh}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* 国家/地区筛选 */}
      {visibleFilters.includes("country") && (
        <Select
          value={filters.countries[0]?.toString() || "all"}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              countries: value === "all" ? [] : [Number(value)],
            })
          }
        >
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="国家/地区" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部地区</SelectItem>
            {FILTER_OPTIONS.countries.map((country) => (
              <SelectItem key={country.id} value={country.id}>
                {country.name_zh}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* 清晰度筛选 */}
      {visibleFilters.includes("resolution") && (
        <Select
          value={filters.standards[0]?.toString() || "all"}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              standards: value === "all" ? [] : [Number(value)],
            })
          }
        >
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="清晰度" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部清晰度</SelectItem>
            <SelectItem value="7">8K</SelectItem>
            <SelectItem value="6">4K</SelectItem>
            <SelectItem value="1">1080p</SelectItem>
            <SelectItem value="2">1080i</SelectItem>
            <SelectItem value="3">720p</SelectItem>
            <SelectItem value="5">SD</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* 视频编码筛选 */}
      {visibleFilters.includes("video") && (
        <Select
          value={filters.videoCodecs[0]?.toString() || "all"}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              videoCodecs: value === "all" ? [] : [Number(value)],
            })
          }
        >
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="视频编码" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部编码</SelectItem>
            <SelectItem value="1">H.264/AVC</SelectItem>
            <SelectItem value="16">H.265/HEVC</SelectItem>
            <SelectItem value="19">AV1</SelectItem>
            <SelectItem value="2">VC-1</SelectItem>
            <SelectItem value="4">MPEG-2</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* 音频编码筛选 */}
      {visibleFilters.includes("audio") && (
        <Select
          value={filters.audioCodecs[0]?.toString() || "all"}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              audioCodecs: value === "all" ? [] : [Number(value)],
            })
          }
        >
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="音频编码" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部编码</SelectItem>
            <SelectItem value="10">TrueHD Atmos</SelectItem>
            <SelectItem value="11">DTS-HD MA</SelectItem>
            <SelectItem value="9">TrueHD</SelectItem>
            <SelectItem value="3">DTS</SelectItem>
            <SelectItem value="1">FLAC</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
