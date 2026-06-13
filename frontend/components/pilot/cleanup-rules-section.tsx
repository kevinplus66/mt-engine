"use client";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Fieldset, FieldsetLegend } from "@/components/ui/fieldset";
import { Separator } from "@/components/ui/separator";
import { NumericField, SectionHeader } from "@/components/pilot/config-fields";
import type { ConfigValidationErrors } from "@/lib/pilot-validation";
import type { CleanupPolicy } from "@/lib/types";

interface CleanupRulesSectionProps {
  cleanup: CleanupPolicy;
  errors: ConfigValidationErrors;
  onUpdate: (key: string, value: unknown, changedFieldId?: string) => void;
}

export function CleanupRulesSection({
  cleanup,
  errors,
  onUpdate,
}: CleanupRulesSectionProps) {
  return (
    <AccordionItem value="cleanup-rules">
      <AccordionTrigger className="px-4 py-4">
        <SectionHeader title="清理规则" />
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-5">
        <div className="space-y-6">
          <Fieldset className="space-y-4">
            <FieldsetLegend>基础清理</FieldsetLegend>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NumericField
                id="min-ratio"
                label="最小分享率"
                min={0}
                step={0.1}
                value={cleanup.min_share_ratio}
                onChange={(value) =>
                  onUpdate("min_share_ratio", value, "min-ratio")
                }
                error={errors["min-ratio"]}
              />
              <NumericField
                id="min-seed-time"
                label="最小做种时间（小时）"
                min={0}
                value={cleanup.min_seed_time_hours}
                onChange={(value) =>
                  onUpdate("min_seed_time_hours", value, "min-seed-time")
                }
                error={errors["min-seed-time"]}
              />
              <NumericField
                id="max-download-time"
                label="最大下载时间（小时）"
                min={0}
                value={cleanup.max_download_time_hours}
                onChange={(value) =>
                  onUpdate(
                    "max_download_time_hours",
                    value,
                    "max-download-time",
                  )
                }
                error={errors["max-download-time"]}
              />
            </div>
          </Fieldset>

          <Separator />

          <Fieldset className="space-y-4">
            <FieldsetLegend>死种检测</FieldsetLegend>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NumericField
                id="dead-seed-minutes"
                label="死种时间（分钟）"
                min={5}
                value={cleanup.dead_seed_minutes}
                onChange={(value) =>
                  onUpdate("dead_seed_minutes", value, "dead-seed-minutes")
                }
                description=">=5 分钟"
                error={errors["dead-seed-minutes"]}
              />
              <NumericField
                id="dead-seed-ratio"
                label="死种最大分享率"
                min={0}
                step={0.01}
                value={cleanup.dead_seed_max_ratio}
                onChange={(value) =>
                  onUpdate("dead_seed_max_ratio", value, "dead-seed-ratio")
                }
                error={errors["dead-seed-ratio"]}
              />
            </div>
          </Fieldset>

          <Separator />

          <Fieldset className="space-y-4">
            <FieldsetLegend>底部淘汰</FieldsetLegend>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NumericField
                id="min-current-users"
                label="最小用户数"
                min={0}
                value={cleanup.min_current_users}
                onChange={(value) =>
                  onUpdate("min_current_users", value, "min-current-users")
                }
                error={errors["min-current-users"]}
              />
              <NumericField
                id="min-upload-speed"
                label="最小上传速度（KB/s）"
                min={0}
                value={cleanup.min_upload_speed_kbps}
                onChange={(value) =>
                  onUpdate("min_upload_speed_kbps", value, "min-upload-speed")
                }
                error={errors["min-upload-speed"]}
              />
              <NumericField
                id="elimination-ratio"
                label="淘汰比例（%）"
                min={0}
                max={50}
                value={cleanup.elimination_ratio}
                onChange={(value) =>
                  onUpdate("elimination_ratio", value, "elimination-ratio")
                }
                description="0-50%"
                error={errors["elimination-ratio"]}
              />
            </div>
          </Fieldset>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
