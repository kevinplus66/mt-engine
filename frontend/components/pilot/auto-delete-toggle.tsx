/**
 * AutoDeleteToggle - 到期删除开关
 * 控制是否自动删除到期的种子
 */

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAutoDelete } from "@/hooks/use-auto-delete";
import { toast } from "sonner";

export function AutoDeleteToggle() {
  const { data, toggle, isLoading } = useAutoDelete();

  const handleToggle = async (checked: boolean) => {
    try {
      await toggle(checked);
      toast.success(checked ? "已开启到期删除" : "已关闭到期删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败");
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <Switch
        id="auto-delete"
        checked={data?.enabled ?? false}
        onCheckedChange={handleToggle}
        disabled={isLoading}
      />
      <Label htmlFor="auto-delete" className="cursor-pointer text-sm">
        到期删除
      </Label>
    </div>
  );
}
