/**
 * StatusTabs - 状态筛选标签
 * 全部 / 做种中 / 下载中 / 未下载
 */

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type UserStatus = "all" | "seeding" | "leeching" | "none";

interface StatusTabsProps {
  status: UserStatus;
  onStatusChange: (status: UserStatus) => void;
}

export function StatusTabs({ status, onStatusChange }: StatusTabsProps) {
  return (
    <Tabs value={status} onValueChange={(v) => onStatusChange(v as UserStatus)}>
      <TabsList>
        <TabsTrigger value="all">全部</TabsTrigger>
        <TabsTrigger value="seeding">做种中</TabsTrigger>
        <TabsTrigger value="leeching">下载中</TabsTrigger>
        <TabsTrigger value="none">未下载</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
