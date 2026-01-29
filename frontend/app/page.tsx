"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* 标题区域 */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight font-mono uppercase">
            MT-Engine
          </h1>
          <p className="text-xl text-muted-foreground font-mono">
            个人 M-Team 管理系统
          </p>
        </div>

        {/* 快速导航 */}
        <Card>
          <CardHeader>
            <CardTitle>快速导航</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button
              onClick={() => router.push("/radar")}
              className="w-full"
              size="lg"
            >
              RADAR - 种子搜索
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              onClick={() => router.push("/sonar")}
              className="w-full"
              size="lg"
              variant="outline"
            >
              SONAR - 免费监控
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              onClick={() => router.push("/pilot")}
              className="w-full"
              size="lg"
              variant="outline"
            >
              PILOT - 自动化配置
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              onClick={() => router.push("/panel")}
              className="w-full"
              size="lg"
              variant="outline"
            >
              PANEL - 数据面板
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
