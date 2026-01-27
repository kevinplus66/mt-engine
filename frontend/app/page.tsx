"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetcher } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [apiStatus, setApiStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [apiMessage, setApiMessage] = useState("");

  const testApiConnection = async () => {
    setApiStatus("loading");
    try {
      await fetcher("/api/health");
      setApiStatus("success");
      setApiMessage("后端 API 连接成功！");
    } catch (error) {
      setApiStatus("error");
      setApiMessage(error instanceof Error ? error.message : "连接失败");
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* 标题区域 */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight font-mono uppercase">
            MT-Engine
          </h1>
          <p className="text-xl text-muted-foreground font-mono">
            智能种子管理系统 - 前端重构
          </p>
          <Badge variant="outline" className="text-sm">
            Next.js 14 + React + TypeScript
          </Badge>
        </div>

        {/* 项目状态卡片 */}
        <Card>
          <CardHeader>
            <CardTitle>项目初始化状态</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <StatusItem label="Next.js 14 项目结构" status="success" />
              <StatusItem label="Tailwind CSS + shadcn/ui" status="success" />
              <StatusItem label="TypeScript 类型定义" status="success" />
              <StatusItem label="SWR + API 客户端" status="success" />
              <StatusItem label="主题系统 (暗色模式)" status="success" />
            </div>
          </CardContent>
        </Card>

        {/* API 连接测试卡片 */}
        <Card>
          <CardHeader>
            <CardTitle>后端 API 连接测试</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Button
                onClick={testApiConnection}
                disabled={apiStatus === "loading"}
              >
                {apiStatus === "loading" && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                测试连接
              </Button>
              {apiStatus === "success" && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>{apiMessage}</span>
                </div>
              )}
              {apiStatus === "error" && (
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-5 w-5" />
                  <span>{apiMessage}</span>
                </div>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              <p>API 端点: /api/health</p>
              <p>代理配置: next.config.ts rewrites</p>
              <p>目标地址: http://localhost:5001</p>
            </div>
          </CardContent>
        </Card>

        {/* 技术栈卡片 */}
        <Card>
          <CardHeader>
            <CardTitle>技术栈</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <h3 className="font-semibold mb-2">核心框架</h3>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Next.js 14 (App Router)</li>
                  <li>• React 19</li>
                  <li>• TypeScript</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">UI 组件</h3>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Tailwind CSS</li>
                  <li>• shadcn/ui</li>
                  <li>• Lucide Icons</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">数据管理</h3>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• SWR</li>
                  <li>• 自动刷新</li>
                  <li>• 乐观更新</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">增强功能</h3>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Framer Motion</li>
                  <li>• AutoAnimate</li>
                  <li>• next-themes</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 下一步 */}
        <Card>
          <CardHeader>
            <CardTitle>下一步计划</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>✅ 阶段 1：项目初始化 (已完成)</li>
              <li>✅ 阶段 2：基础设施 (已完成)</li>
              <li>⏳ 阶段 3：RADAR 页面 (种子搜索)</li>
              <li>⏳ 阶段 4：SONAR 页面 (免费监控)</li>
              <li>⏳ 阶段 5：PILOT 页面 (自动化配置)</li>
              <li>⏳ 阶段 6：PANEL 页面 (数据面板)</li>
            </ul>
          </CardContent>
        </Card>

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

function StatusItem({ label, status }: { label: string; status: "success" | "error" | "pending" }) {
  return (
    <div className="flex items-center gap-2">
      {status === "success" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
      {status === "error" && <XCircle className="h-5 w-5 text-red-600" />}
      {status === "pending" && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      <span className="text-sm">{label}</span>
    </div>
  );
}
