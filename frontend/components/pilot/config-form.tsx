"use client";

import { Accordion } from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { CleanupRulesSection } from "@/components/pilot/cleanup-rules-section";
import { DownloadRulesSection } from "@/components/pilot/download-rules-section";
import { DownloadSettingsSection } from "@/components/pilot/download-settings-section";
import { NotificationSection } from "@/components/pilot/notification-section";
import type { AutomationConfig } from "@/lib/types";
import type { ConfigValidationErrors } from "@/lib/pilot-validation";

export type { ConfigValidationErrors } from "@/lib/pilot-validation";

interface ConfigFormProps {
  config: AutomationConfig;
  errors?: ConfigValidationErrors;
  openSections: string[];
  onOpenSectionsChange: (sections: string[]) => void;
  onConfigChange: (config: AutomationConfig, changedFieldId?: string) => void;
}

export function ConfigForm({
  config,
  errors = {},
  openSections,
  onOpenSectionsChange,
  onConfigChange,
}: ConfigFormProps) {
  const updateDownload = (
    key: string,
    value: unknown,
    changedFieldId?: string,
  ) => {
    onConfigChange(
      {
        ...config,
        download: {
          ...config.download,
          [key]: value,
        },
      },
      changedFieldId,
    );
  };

  const updateDownloadRules = (
    key: string,
    value: unknown,
    changedFieldId?: string,
  ) => {
    onConfigChange(
      {
        ...config,
        download: {
          ...config.download,
          rules: {
            ...config.download.rules,
            [key]: value,
          },
        },
      },
      changedFieldId,
    );
  };

  const updateCleanup = (
    key: string,
    value: unknown,
    changedFieldId?: string,
  ) => {
    onConfigChange(
      {
        ...config,
        cleanup: {
          ...config.cleanup,
          [key]: value,
        },
      },
      changedFieldId,
    );
  };

  return (
    <Card>
      <Accordion
        multiple
        value={openSections}
        onValueChange={(value) => onOpenSectionsChange(value as string[])}
        className="w-full"
      >
        <DownloadSettingsSection
          download={config.download}
          errors={errors}
          onUpdate={updateDownload}
        />
        <DownloadRulesSection
          rules={config.download.rules}
          errors={errors}
          onUpdate={updateDownloadRules}
        />
        <CleanupRulesSection
          cleanup={config.cleanup}
          errors={errors}
          onUpdate={updateCleanup}
        />
        <NotificationSection
          enabled={config.enable_notification}
          onChange={(checked) =>
            onConfigChange(
              { ...config, enable_notification: checked },
              "notification-enabled",
            )
          }
        />
      </Accordion>
    </Card>
  );
}
