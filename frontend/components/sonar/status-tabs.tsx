import { SegmentedControl } from "@/components/common/segmented-control";

type UserStatus = "all" | "seeding" | "leeching" | "none";

interface StatusTabsProps {
  status: UserStatus;
  onStatusChange: (status: UserStatus) => void;
}

export function StatusTabs({ status, onStatusChange }: StatusTabsProps) {
  const options = [
    { value: "all" as const, label: "全部" },
    { value: "seeding" as const, label: "做种中" },
    { value: "leeching" as const, label: "下载中" },
    { value: "none" as const, label: "未下载" },
  ];

  return (
    <SegmentedControl
      ariaLabel="按下载状态筛选"
      value={status}
      options={options}
      onValueChange={onStatusChange}
    />
  );
}
