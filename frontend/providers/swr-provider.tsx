"use client";

import { SWRConfig } from "swr";
import { fetcher } from "@/lib/api";
import { toast } from "@/lib/toast";

interface SWRProviderProps {
  children: React.ReactNode;
}

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        fetcher,
        onError: (error) => {
          // 显示错误提示
          toast.error(error.message || "请求失败");
        },
        revalidateOnFocus: false,
        shouldRetryOnError: false,
        dedupingInterval: 2000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
