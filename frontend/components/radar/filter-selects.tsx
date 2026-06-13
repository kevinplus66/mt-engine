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

type NamedOption = {
  id: string | number;
  name?: string;
  name_zh?: string;
  name_en?: string;
};

type SelectOption = {
  value: string;
  label: string;
};

function getOptionLabel(option: NamedOption) {
  return option.name_zh || option.name || option.name_en || String(option.id);
}

function buildSelectOptions(
  defaultLabel: string,
  options: readonly NamedOption[],
): SelectOption[] {
  return [
    { value: "all", label: defaultLabel },
    ...options.map((option) => ({
      value: String(option.id),
      label: getOptionLabel(option),
    })),
  ];
}

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
  const { data: filterOptions } = useFilterOptions();
  const visibleFilters = FILTER_CONFIG[mode] || [];

  if (visibleFilters.length === 0) {
    return null;
  }

  const handleDiscountChange = (value: string | null) => {
    const nextValue = value ?? "all";
    onFiltersChange({
      ...filters,
      discount: nextValue === "all" ? "" : nextValue,
    });
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
  const discountOptions = buildSelectOptions("全部优惠", discounts);
  const countryOptions = buildSelectOptions("全部地区", countries);
  const standardOptions = buildSelectOptions("全部清晰度", standards);
  const videoCodecOptions = buildSelectOptions("全部视频编码", videoCodecs);
  const audioCodecOptions = buildSelectOptions("全部音频编码", audioCodecs);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {/* 优惠筛选 - 所有模式都显示 */}
      {visibleFilters.includes("discount") && (
        <Select
          items={discountOptions}
          value={filters.discount || "all"}
          onValueChange={handleDiscountChange}
        >
          <SelectTrigger className="w-full" aria-label="优惠筛选">
            <SelectValue placeholder="优惠" />
          </SelectTrigger>
          <SelectContent>
            {discountOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* 国家/地区筛选 */}
      {visibleFilters.includes("country") && (
        <Select
          items={countryOptions}
          value={filters.countries[0]?.toString() || "all"}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              countries: !value || value === "all" ? [] : [Number(value)],
            })
          }
        >
          <SelectTrigger className="w-full" aria-label="国家/地区筛选">
            <SelectValue placeholder="国家/地区" />
          </SelectTrigger>
          <SelectContent>
            {countryOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* 清晰度筛选 */}
      {visibleFilters.includes("resolution") && (
        <Select
          items={standardOptions}
          value={filters.standards[0]?.toString() || "all"}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              standards: !value || value === "all" ? [] : [Number(value)],
            })
          }
        >
          <SelectTrigger className="w-full" aria-label="清晰度筛选">
            <SelectValue placeholder="清晰度" />
          </SelectTrigger>
          <SelectContent>
            {standardOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* 视频编码筛选 */}
      {visibleFilters.includes("video") && (
        <Select
          items={videoCodecOptions}
          value={filters.videoCodecs[0]?.toString() || "all"}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              videoCodecs: !value || value === "all" ? [] : [Number(value)],
            })
          }
        >
          <SelectTrigger className="w-full" aria-label="视频编码筛选">
            <SelectValue placeholder="视频编码" />
          </SelectTrigger>
          <SelectContent>
            {videoCodecOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* 音频编码筛选 */}
      {visibleFilters.includes("audio") && (
        <Select
          items={audioCodecOptions}
          value={filters.audioCodecs[0]?.toString() || "all"}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              audioCodecs: !value || value === "all" ? [] : [Number(value)],
            })
          }
        >
          <SelectTrigger className="w-full" aria-label="音频编码筛选">
            <SelectValue placeholder="音频编码" />
          </SelectTrigger>
          <SelectContent>
            {audioCodecOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
