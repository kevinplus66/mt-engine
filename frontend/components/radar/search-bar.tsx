/**
 * SearchBar - 搜索栏组件
 * 包含关键词输入、搜索按钮、重置按钮
 */

import { SearchResetBar } from "@/components/common/search-reset-bar";

interface SearchBarProps {
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  onSearch: () => void;
  onReset: () => void;
  isLoading?: boolean;
}

export function SearchBar({
  keyword,
  onKeywordChange,
  onSearch,
  onReset,
  isLoading = false,
}: SearchBarProps) {
  return (
    <SearchResetBar
      value={keyword}
      onValueChange={onKeywordChange}
      onSearch={onSearch}
      onReset={onReset}
      isLoading={isLoading}
      placeholder="输入关键词，如 2160p H.265…"
      searchLabel={isLoading ? "搜索中…" : "搜索"}
      showSearchButton
    />
  );
}
