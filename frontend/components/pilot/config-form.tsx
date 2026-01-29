/**
 * ConfigForm - PILOT 配置表单
 * 包含下载策略、清理策略、通知设置
 * 使用 Accordion 布局，移动端友好
 */

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { AutomationConfig } from "@/lib/types";

interface ConfigFormProps {
  config: AutomationConfig;
  onConfigChange: (config: AutomationConfig) => void;
}

export function ConfigForm({ config, onConfigChange }: ConfigFormProps) {
  const updateDownload = (key: string, value: any) => {
    onConfigChange({
      ...config,
      download: {
        ...config.download,
        [key]: value,
      },
    });
  };

  const updateDownloadRules = (key: string, value: any) => {
    onConfigChange({
      ...config,
      download: {
        ...config.download,
        rules: {
          ...config.download.rules,
          [key]: value,
        },
      },
    });
  };

  const updateCleanup = (key: string, value: any) => {
    onConfigChange({
      ...config,
      cleanup: {
        ...config.cleanup,
        [key]: value,
      },
    });
  };

  return (
    <Card>
      <Accordion type="single" collapsible defaultValue="download-settings" className="w-full">
        {/* Section 1: Download Settings */}
        <AccordionItem value="download-settings" className="relative">
          <div className="flex items-center justify-between py-4 px-4">
            <AccordionTrigger className="flex-1 hover:no-underline">
              <span>下载设置</span>
            </AccordionTrigger>
            <div className="flex items-center gap-2 ml-4">
              <Switch
                id="download-enabled-trigger"
                checked={config.download.enabled}
                onCheckedChange={(checked) => updateDownload("enabled", checked)}
              />
              <Label htmlFor="download-enabled-trigger" className="text-xs cursor-pointer">
                {config.download.enabled ? "已启用" : "已禁用"}
              </Label>
            </div>
          </div>
          <AccordionContent>
            <div className="space-y-6">
              {/* Basic Config */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="max-tasks">最大任务数</Label>
                  <Input
                    id="max-tasks"
                    name="max-tasks"
                    autoComplete="off"
                    type="number"
                    min="1"
                    max="50"
                    value={config.download.max_active_tasks}
                    onChange={(e) =>
                      updateDownload("max_active_tasks", Number(e.target.value))
                    }
                  />
                  <p className="text-xs text-muted-foreground">1-50</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="interval">检查间隔（秒）</Label>
                  <Input
                    id="interval"
                    name="interval"
                    autoComplete="off"
                    type="number"
                    min="60"
                    value={config.download.interval_seconds}
                    onChange={(e) =>
                      updateDownload("interval_seconds", Number(e.target.value))
                    }
                  />
                  <p className="text-xs text-muted-foreground">≥60秒</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="disk-threshold">磁盘阈值（%）</Label>
                  <Input
                    id="disk-threshold"
                    name="disk-threshold"
                    autoComplete="off"
                    type="number"
                    min="50"
                    max="95"
                    value={config.download.disk_usage_threshold}
                    onChange={(e) =>
                      updateDownload("disk_usage_threshold", Number(e.target.value))
                    }
                  />
                  <p className="text-xs text-muted-foreground">50-95%</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="save-path">保存路径</Label>
                <Input
                  id="save-path"
                  name="save-path"
                  autoComplete="off"
                  type="text"
                  value={config.download.save_path}
                  onChange={(e) => updateDownload("save_path", e.target.value)}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section 2: Download Rules */}
        <AccordionItem value="download-rules" className="relative">
          <div className="flex items-center justify-between py-4 px-4">
            <AccordionTrigger className="flex-1 hover:no-underline">
              <span>筛选规则</span>
            </AccordionTrigger>
          </div>
          <AccordionContent>
            <div className="space-y-6">
              {/* Size & Seeders */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="min-size">最小体积（GB）</Label>
                  <Input
                    id="min-size"
                    name="min-size"
                    autoComplete="off"
                    type="number"
                    min="0"
                    step="0.1"
                    value={config.download.rules.min_size_gb}
                    onChange={(e) =>
                      updateDownloadRules("min_size_gb", Number(e.target.value))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-size">最大体积（GB）</Label>
                  <Input
                    id="max-size"
                    name="max-size"
                    autoComplete="off"
                    type="number"
                    min="0"
                    step="0.1"
                    value={config.download.rules.max_size_gb}
                    onChange={(e) =>
                      updateDownloadRules("max_size_gb", Number(e.target.value))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-seeders">最大做种数</Label>
                  <Input
                    id="max-seeders"
                    name="max-seeders"
                    autoComplete="off"
                    type="number"
                    min="0"
                    value={config.download.rules.max_seeders}
                    onChange={(e) =>
                      updateDownloadRules("max_seeders", Number(e.target.value))
                    }
                  />
                  <p className="text-xs text-muted-foreground">0=不限制</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min-leechers">最小下载数</Label>
                  <Input
                    id="min-leechers"
                    name="min-leechers"
                    autoComplete="off"
                    type="number"
                    min="0"
                    value={config.download.rules.min_leechers}
                    onChange={(e) =>
                      updateDownloadRules("min_leechers", Number(e.target.value))
                    }
                  />
                </div>
              </div>

              <Separator />

              {/* Keywords */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="include-keywords">包含关键词（逗号分隔）</Label>
                  <Input
                    id="include-keywords"
                    name="include-keywords"
                    autoComplete="off"
                    type="text"
                    placeholder="例如: movie, series..."
                    value={config.download.rules.include_keywords.join(", ")}
                    onChange={(e) =>
                      updateDownloadRules(
                        "include_keywords",
                        e.target.value.split(",").map((k) => k.trim()).filter(Boolean)
                      )
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="exclude-keywords">排除关键词（逗号分隔）</Label>
                  <Input
                    id="exclude-keywords"
                    name="exclude-keywords"
                    autoComplete="off"
                    type="text"
                    placeholder="例如: AUDIOBOOK..."
                    value={config.download.rules.exclude_keywords.join(", ")}
                    onChange={(e) =>
                      updateDownloadRules(
                        "exclude_keywords",
                        e.target.value.split(",").map((k) => k.trim()).filter(Boolean)
                      )
                    }
                  />
                </div>
              </div>

              <Separator />

              {/* Weights */}
              <div>
                <h3 className="text-sm font-semibold mb-4">评分权重</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="weight-size">体积权重</Label>
                    <Input
                      id="weight-size"
                      name="weight-size"
                      autoComplete="off"
                      type="number"
                      min="-10"
                      max="10"
                      step="0.1"
                      value={config.download.rules.weight_size}
                      onChange={(e) =>
                        updateDownloadRules("weight_size", Number(e.target.value))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="weight-free-time">免费时长权重</Label>
                    <Input
                      id="weight-free-time"
                      name="weight-free-time"
                      autoComplete="off"
                      type="number"
                      min="-10"
                      max="10"
                      step="0.1"
                      value={config.download.rules.weight_free_time}
                      onChange={(e) =>
                        updateDownloadRules("weight_free_time", Number(e.target.value))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="weight-age">发布时间权重</Label>
                    <Input
                      id="weight-age"
                      name="weight-age"
                      autoComplete="off"
                      type="number"
                      min="-10"
                      max="10"
                      step="0.1"
                      value={config.download.rules.weight_age}
                      onChange={(e) =>
                        updateDownloadRules("weight_age", Number(e.target.value))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="weight-seeders">做种数权重</Label>
                    <Input
                      id="weight-seeders"
                      name="weight-seeders"
                      autoComplete="off"
                      type="number"
                      min="-10"
                      max="10"
                      step="0.1"
                      value={config.download.rules.weight_seeders}
                      onChange={(e) =>
                        updateDownloadRules("weight_seeders", Number(e.target.value))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section 3: Cleanup Rules */}
        <AccordionItem value="cleanup-rules" className="relative">
          <div className="flex items-center justify-between py-4 px-4">
            <AccordionTrigger className="flex-1 hover:no-underline">
              <span>清理规则</span>
            </AccordionTrigger>
            <div className="flex items-center gap-2 ml-4">
              <Switch
                id="cleanup-enabled-trigger"
                checked={config.cleanup.enabled}
                onCheckedChange={(checked) => updateCleanup("enabled", checked)}
              />
              <Label htmlFor="cleanup-enabled-trigger" className="text-xs cursor-pointer">
                {config.cleanup.enabled ? "已启用" : "已禁用"}
              </Label>
            </div>
          </div>
          <AccordionContent>
            <div className="space-y-6">
              {/* Basic Cleanup */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="min-ratio">最小分享率</Label>
                  <Input
                    id="min-ratio"
                    name="min-ratio"
                    autoComplete="off"
                    type="number"
                    min="0"
                    step="0.1"
                    value={config.cleanup.min_share_ratio}
                    onChange={(e) =>
                      updateCleanup("min_share_ratio", Number(e.target.value))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min-seed-time">最小做种时间（小时）</Label>
                  <Input
                    id="min-seed-time"
                    name="min-seed-time"
                    autoComplete="off"
                    type="number"
                    min="0"
                    value={config.cleanup.min_seed_time_hours}
                    onChange={(e) =>
                      updateCleanup("min_seed_time_hours", Number(e.target.value))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-download-time">最大下载时间（小时）</Label>
                  <Input
                    id="max-download-time"
                    name="max-download-time"
                    autoComplete="off"
                    type="number"
                    min="0"
                    value={config.cleanup.max_download_time_hours}
                    onChange={(e) =>
                      updateCleanup("max_download_time_hours", Number(e.target.value))
                    }
                  />
                </div>
              </div>

              <Separator />

              {/* Dead Seed Detection */}
              <div>
                <h3 className="text-sm font-semibold mb-4">死种检测</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="dead-seed-minutes">死种时间（分钟）</Label>
                    <Input
                      id="dead-seed-minutes"
                      name="dead-seed-minutes"
                      autoComplete="off"
                      type="number"
                      min="5"
                      value={config.cleanup.dead_seed_minutes}
                      onChange={(e) =>
                        updateCleanup("dead_seed_minutes", Number(e.target.value))
                      }
                    />
                    <p className="text-xs text-muted-foreground">≥5分钟</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dead-seed-ratio">死种最大分享率</Label>
                    <Input
                      id="dead-seed-ratio"
                      name="dead-seed-ratio"
                      autoComplete="off"
                      type="number"
                      min="0"
                      step="0.01"
                      value={config.cleanup.dead_seed_max_ratio}
                      onChange={(e) =>
                        updateCleanup("dead_seed_max_ratio", Number(e.target.value))
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Elimination */}
              <div>
                <h3 className="text-sm font-semibold mb-4">底部淘汰</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="min-current-users">最小用户数</Label>
                    <Input
                      id="min-current-users"
                      name="min-current-users"
                      autoComplete="off"
                      type="number"
                      min="0"
                      value={config.cleanup.min_current_users}
                      onChange={(e) =>
                        updateCleanup("min_current_users", Number(e.target.value))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="min-upload-speed">最小上传速度（KB/s）</Label>
                    <Input
                      id="min-upload-speed"
                      name="min-upload-speed"
                      autoComplete="off"
                      type="number"
                      min="0"
                      value={config.cleanup.min_upload_speed_kbps}
                      onChange={(e) =>
                        updateCleanup("min_upload_speed_kbps", Number(e.target.value))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="elimination-ratio">淘汰比例（%）</Label>
                    <Input
                      id="elimination-ratio"
                      name="elimination-ratio"
                      autoComplete="off"
                      type="number"
                      min="0"
                      max="50"
                      value={config.cleanup.elimination_ratio}
                      onChange={(e) =>
                        updateCleanup("elimination_ratio", Number(e.target.value))
                      }
                    />
                    <p className="text-xs text-muted-foreground">0-50%</p>
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section 4: Notifications */}
        <AccordionItem value="notifications" className="relative">
          <div className="flex items-center justify-between py-4 px-4">
            <AccordionTrigger className="flex-1 hover:no-underline">
              <span>通知设置</span>
            </AccordionTrigger>
          </div>
          <AccordionContent>
            <div className="flex items-center space-x-2">
              <Switch
                id="notification-enabled"
                checked={config.enable_notification}
                onCheckedChange={(checked) =>
                  onConfigChange({ ...config, enable_notification: checked })
                }
              />
              <Label htmlFor="notification-enabled">微信通知（关闭功能未开发）</Label>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
