"use client";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Fieldset } from "@/components/ui/fieldset";
import {
  NumericField,
  SectionHeader,
  TextField,
} from "@/components/pilot/config-fields";
import type { ConfigValidationErrors } from "@/lib/pilot-validation";
import type { DownloadPolicy } from "@/lib/types";

interface DownloadSettingsSectionProps {
  download: DownloadPolicy;
  errors: ConfigValidationErrors;
  onUpdate: (key: string, value: unknown, changedFieldId?: string) => void;
}

export function DownloadSettingsSection({
  download,
  errors,
  onUpdate,
}: DownloadSettingsSectionProps) {
  return (
    <AccordionItem value="download-settings">
      <AccordionTrigger className="px-4 py-4">
        <SectionHeader title="下载设置" />
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-5">
        <Fieldset className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NumericField
              id="max-tasks"
              label="最大任务数"
              min={1}
              max={50}
              value={download.max_active_tasks}
              onChange={(value) =>
                onUpdate("max_active_tasks", value, "max-tasks")
              }
              description="1-50"
              error={errors["max-tasks"]}
            />
            <NumericField
              id="interval"
              label="检查间隔（秒）"
              min={60}
              value={download.interval_seconds}
              onChange={(value) =>
                onUpdate("interval_seconds", value, "interval")
              }
              description=">=60 秒"
              error={errors.interval}
            />
            <NumericField
              id="disk-threshold"
              label="磁盘阈值（%）"
              min={50}
              max={95}
              value={download.disk_usage_threshold}
              onChange={(value) =>
                onUpdate("disk_usage_threshold", value, "disk-threshold")
              }
              description="50-95%"
              error={errors["disk-threshold"]}
            />
          </div>
          <TextField
            id="save-path"
            label="保存路径"
            value={download.save_path}
            onChange={(value) => onUpdate("save_path", value, "save-path")}
            error={errors["save-path"]}
          />
        </Fieldset>
      </AccordionContent>
    </AccordionItem>
  );
}
