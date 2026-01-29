/**
 * SearchBar - 搜索栏组件
 * 包含关键词输入、搜索按钮、重置按钮
 */

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RotateCcw, Loader2, Telescope } from "lucide-react";

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
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isLoading) {
      onSearch();
    }
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          name="search"
          autoComplete="off"
          placeholder="输入关键词搜索..."
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          onKeyDown={handleKeyPress}
          className="pl-9"
          disabled={isLoading}
        />
      </div>
      <Button onClick={onSearch} disabled={isLoading} size="default" className="w-full sm:w-auto">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            搜索中
          </>
        ) : (
          <>
            <Telescope className="mr-2 h-4 w-4" />
            搜索
          </>
        )}
      </Button>
      <Button
        onClick={onReset}
        disabled={isLoading}
        variant="outline"
        size="default"
        className="w-full sm:w-auto"
      >
        <RotateCcw className="mr-2 h-4 w-4" />
        重置
      </Button>
    </div>
  );
}
