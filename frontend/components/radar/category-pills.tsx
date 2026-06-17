/**
 * CategoryPills - 分类选择按钮组
 * 根据搜索模式显示不同的分类选项
 */

import { MultiSegmentedControl } from "@/components/common/segmented-control";
import { CATEGORY_MAP } from "@/lib/constants";
import type { SearchMode } from "@/lib/types";

interface CategoryPillsProps {
  mode: SearchMode;
  selectedCategories: number[];
  onCategoriesChange: (categories: number[]) => void;
}

export function CategoryPills({
  mode,
  selectedCategories,
  onCategoriesChange,
}: CategoryPillsProps) {
  const categories = CATEGORY_MAP[mode] || [];

  if (categories.length === 0) {
    return null;
  }

  const getCategoryIds = (categoryId: string | number) =>
    String(categoryId)
      .split(",")
      .map((id) => Number(id));

  const isSelected = (categoryId: string | number) => {
    const ids = getCategoryIds(categoryId);
    const allSelected = ids.every((id) => selectedCategories.includes(id));
    return allSelected;
  };

  const selectedValues = categories
    .filter((category) => isSelected(category.id))
    .map((category) => String(category.id));

  const handleGroupChange = (values: string[]) => {
    const visibleIds = new Set(categories.flatMap((category) => getCategoryIds(category.id)));
    const preservedCategories = selectedCategories.filter((id) => !visibleIds.has(id));
    const nextCategories = Array.from(
      new Set([
        ...preservedCategories,
        ...values.flatMap((value) => getCategoryIds(value)),
      ])
    );
    onCategoriesChange(nextCategories);
  };

  return (
    <div className="space-y-2">
      <div className="text-muted-foreground text-sm font-medium">分类筛选</div>
      <MultiSegmentedControl
        ariaLabel="分类筛选"
        value={selectedValues}
        options={categories.map((category) => ({
          value: String(category.id),
          label: category.name_zh,
        }))}
        onValueChange={handleGroupChange}
      />
    </div>
  );
}
