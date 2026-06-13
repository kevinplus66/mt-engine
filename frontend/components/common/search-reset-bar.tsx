"use client";

import type { KeyboardEvent } from "react";
import { RotateCcw, Search, Telescope } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

interface SearchResetBarProps {
  value: string;
  onValueChange: (value: string) => void;
  onReset: () => void;
  onSearch?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  searchLabel?: string;
  showSearchButton?: boolean;
}

const normalizeEllipsis = (value: string) => value.replace(/\.{3}/g, "…");

export function SearchResetBar({
  value,
  onValueChange,
  onReset,
  onSearch,
  isLoading = false,
  placeholder = "搜索…",
  searchLabel = "搜索",
  showSearchButton = false,
}: SearchResetBarProps) {
  const displayPlaceholder = normalizeEllipsis(placeholder);
  const displaySearchLabel = normalizeEllipsis(searchLabel);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (
      event.key === "Enter" &&
      !event.nativeEvent.isComposing &&
      onSearch &&
      !isLoading
    ) {
      onSearch();
    }
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <InputGroup className="flex-1">
        <InputGroupAddon>
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          type="text"
          name="search"
          autoComplete="off"
          placeholder={displayPlaceholder}
          aria-label={displaySearchLabel}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </InputGroup>
      {showSearchButton && onSearch && (
        <Button
          onClick={onSearch}
          disabled={isLoading}
          loading={isLoading}
          className="w-full sm:w-auto"
        >
          <Telescope className="size-4" aria-hidden="true" />
          {displaySearchLabel}
        </Button>
      )}
      <Button
        onClick={onReset}
        disabled={isLoading}
        variant="outline"
        className="w-full sm:w-auto"
      >
        <RotateCcw className="size-4" aria-hidden="true" />
        重置
      </Button>
    </div>
  );
}
