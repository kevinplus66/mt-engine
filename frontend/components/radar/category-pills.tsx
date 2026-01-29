/**
 * CategoryPills - 分类选择按钮组
 * 根据搜索模式显示不同的分类选项
 */

import { Badge } from "@/components/ui/badge";
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

  const handleToggle = (categoryId: string | number) => {
    // 处理逗号分隔的ID（如 "449,405"）
    const ids = String(categoryId)
      .split(",")
      .map((id) => Number(id));

    // 检查是否所有ID都已选中
    const allSelected = ids.every((id) => selectedCategories.includes(id));

    if (allSelected) {
      // 移除所有这些ID
      onCategoriesChange(
        selectedCategories.filter((id) => !ids.includes(id))
      );
    } else {
      // 添加所有这些ID
      const newCategories = [...selectedCategories];
      ids.forEach((id) => {
        if (!newCategories.includes(id)) {
          newCategories.push(id);
        }
      });
      onCategoriesChange(newCategories);
    }
  };

  const isSelected = (categoryId: string | number) => {
    const ids = String(categoryId)
      .split(",")
      .map((id) => Number(id));
    return ids.every((id) => selectedCategories.includes(id));
  };

  return (
    <div className="space-y-2">
      <div className="text-base text-muted-foreground font-mono uppercase">分类筛选</div>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const selected = isSelected(category.id);
          return (
            <Badge
              key={String(category.id)}
              variant={selected ? "default" : "outline"}
              className="cursor-pointer hover:translate-y-[-1px] transition-transform text-sm px-3 py-1"
              onClick={() => handleToggle(category.id)}
            >
              {category.name_zh}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
