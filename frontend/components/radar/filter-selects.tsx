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
import { useFilterOptions } from "@/hooks/use-filter-options";
import type { SearchMode } from "@/lib/types";

// Hardcoded fallback data for standards (resolution)
const FALLBACK_STANDARDS = [
  { id: "7", name_zh: "8K", name_en: "8K" },
  { id: "6", name_zh: "4K", name_en: "4K" },
  { id: "1", name_zh: "1080p", name_en: "1080p" },
  { id: "2", name_zh: "1080i", name_en: "1080i" },
  { id: "3", name_zh: "720p", name_en: "720p" },
  { id: "5", name_zh: "SD", name_en: "SD" },
];

// Hardcoded fallback data for video codecs
const FALLBACK_VIDEO_CODECS = [
  { id: "1", name_zh: "H.264/AVC", name_en: "H.264/AVC" },
  { id: "16", name_zh: "H.265/HEVC", name_en: "H.265/HEVC" },
  { id: "19", name_zh: "AV1", name_en: "AV1" },
  { id: "2", name_zh: "VC-1", name_en: "VC-1" },
  { id: "4", name_zh: "MPEG-2", name_en: "MPEG-2" },
];

// Hardcoded fallback data for audio codecs
const FALLBACK_AUDIO_CODECS = [
  { id: "10", name_zh: "TrueHD Atmos", name_en: "TrueHD Atmos" },
  { id: "11", name_zh: "DTS-HD MA", name_en: "DTS-HD MA" },
  { id: "9", name_zh: "TrueHD", name_en: "TrueHD" },
  { id: "3", name_zh: "DTS", name_en: "DTS" },
  { id: "1", name_zh: "FLAC", name_en: "FLAC" },
];

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
  const { data: filterOptions, isLoading, error } = useFilterOptions();
  const visibleFilters = FILTER_CONFIG[mode] || [];

  if (visibleFilters.length === 0) {
    return null;
  }

  const handleDiscountChange = (value: string) => {
    onFiltersChange({ ...filters, discount: value === "all" ? "" : value });
  };

  // 使用动态数据或回退到硬编码数据
  const countries = filterOptions?.countries || FILTER_OPTIONS.countries;
  const standards = (filterOptions?.standards && filterOptions.standards.length > 0)
    ? filterOptions.standards
    : FALLBACK_STANDARDS;
  const videoCodecs = (filterOptions?.videoCodecs && filterOptions.videoCodecs.length > 0)
    ? filterOptions.videoCodecs
    : FALLBACK_VIDEO_CODECS;
  const audioCodecs = (filterOptions?.audioCodecs && filterOptions.audioCodecs.length > 0)
    ? filterOptions.audioCodecs
    : FALLBACK_AUDIO_CODECS;
  const discounts = FILTER_OPTIONS.discounts; // 优惠选项保持从常量获取

  // Debug logging
  if (typeof window !== 'undefined') {
    console.log('Filter options:', { standards, videoCodecs, audioCodecs, isLoading, error });
  }

  return (
    <div className="flex flex-wrap gap-3">
      {/* 优惠筛选 - 所有模式都显示 */}
      {visibleFilters.includes("discount") && (
        <Select value={filters.discount || "all"} onValueChange={handleDiscountChange}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="优惠" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">优惠</SelectItem>
            {discounts.map((discount) => (
              <SelectItem key={discount.id} value={discount.id.toString()}>
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
            <SelectItem value="all">地区</SelectItem>
            {countries.map((country) => (
              <SelectItem key={country.id} value={country.id.toString()}>
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
            <SelectItem value="all">清晰度</SelectItem>
            {standards.map((standard) => (
              <SelectItem key={standard.id} value={standard.id.toString()}>
                {(standard as any).name_zh || (standard as any).name}
              </SelectItem>
            ))}
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
            <SelectItem value="all">视频编码</SelectItem>
            {videoCodecs.map((codec) => (
              <SelectItem key={codec.id} value={codec.id.toString()}>
                {(codec as any).name_zh || (codec as any).name}
              </SelectItem>
            ))}
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
            <SelectItem value="all">音频编码</SelectItem>
            {audioCodecs.map((codec) => (
              <SelectItem key={codec.id} value={codec.id.toString()}>
                {(codec as any).name_zh || (codec as any).name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
