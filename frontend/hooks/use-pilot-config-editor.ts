"use client";

import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import {
  arePilotConfigsEqual,
  getConfigSectionsForErrors,
  getFirstConfigErrorField,
  INITIAL_CONFIG_SECTIONS,
  validateAutomationConfig,
  type ConfigValidationErrors,
} from "@/lib/pilot-validation";
import type { AutomationConfig } from "@/lib/types";

interface UsePilotConfigEditorOptions {
  config?: AutomationConfig;
  saveConfig: (config: AutomationConfig) => Promise<void>;
}

export function usePilotConfigEditor({
  config,
  saveConfig,
}: UsePilotConfigEditorOptions) {
  const [editedConfig, setEditedConfig] = useState<AutomationConfig | null>(
    null,
  );
  const [savedConfig, setSavedConfig] = useState<AutomationConfig | null>(null);
  const [validationErrors, setValidationErrors] =
    useState<ConfigValidationErrors>({});
  const [configSections, setConfigSections] = useState<string[]>(
    INITIAL_CONFIG_SECTIONS,
  );
  const [pendingFocusFieldId, setPendingFocusFieldId] = useState<string | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!config) return;

    setSavedConfig(config);
    setEditedConfig((current) => {
      if (!current || !savedConfig || arePilotConfigsEqual(current, savedConfig)) {
        return config;
      }

      return current;
    });
  }, [config, savedConfig]);

  const isConfigDirty = Boolean(
    editedConfig &&
      savedConfig &&
      !arePilotConfigsEqual(editedConfig, savedConfig),
  );

  useEffect(() => {
    if (!isConfigDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isConfigDirty]);

  useEffect(() => {
    if (!pendingFocusFieldId) return;

    const animationFrame = window.requestAnimationFrame(() => {
      const namedElement = document.getElementsByName(pendingFocusFieldId)[0];
      const target = namedElement ?? document.getElementById(pendingFocusFieldId);

      if (target instanceof HTMLElement) {
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      }

      setPendingFocusFieldId(null);
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [pendingFocusFieldId, configSections]);

  const showValidationErrors = (errors: ConfigValidationErrors) => {
    const firstErrorField = getFirstConfigErrorField(errors);
    setValidationErrors(errors);
    setConfigSections((current) =>
      Array.from(new Set([...current, ...getConfigSectionsForErrors(errors)])),
    );
    setPendingFocusFieldId(firstErrorField);
    toast.error("请先修正表单中的错误");
  };

  const validateConfigForSave = (configToSave: AutomationConfig) => {
    const errors = validateAutomationConfig(configToSave);
    if (getFirstConfigErrorField(errors)) {
      showValidationErrors(errors);
      return false;
    }

    setValidationErrors({});
    return true;
  };

  const handleConfigChange = (
    nextConfig: AutomationConfig,
    changedFieldId?: string,
  ) => {
    setEditedConfig(nextConfig);
    if (!changedFieldId) return;

    setValidationErrors((current) => {
      if (!current[changedFieldId]) return current;

      const nextErrors = { ...current };
      delete nextErrors[changedFieldId];
      return nextErrors;
    });
  };

  const saveConfigQuietly = async (configToSave: AutomationConfig) => {
    if (!validateConfigForSave(configToSave)) return;

    try {
      await saveConfig(configToSave);
      setSavedConfig(configToSave);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    }
  };

  const handleSave = async () => {
    if (!editedConfig) return;
    if (!validateConfigForSave(editedConfig)) return;

    setIsSaving(true);
    try {
      await saveConfig(editedConfig);
      setSavedConfig(editedConfig);
      setValidationErrors({});
      toast.success("配置保存成功");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    const currentConfig = savedConfig ?? config;
    if (currentConfig) {
      setEditedConfig(currentConfig);
      setValidationErrors({});
      toast.success("已重置为当前配置");
    }
  };

  const handleDownloadToggle = async (enabled: boolean) => {
    const baselineConfig = savedConfig ?? config;
    if (!baselineConfig) return;

    const configToSave = {
      ...baselineConfig,
      download: { ...baselineConfig.download, enabled },
    };

    setEditedConfig((current) => {
      const draftConfig = current ?? baselineConfig;
      return {
        ...draftConfig,
        download: { ...draftConfig.download, enabled },
      };
    });
    await saveConfigQuietly(configToSave);
  };

  const handleCleanupToggle = async (enabled: boolean) => {
    const baselineConfig = savedConfig ?? config;
    if (!baselineConfig) return;

    const configToSave = {
      ...baselineConfig,
      cleanup: { ...baselineConfig.cleanup, enabled },
    };

    setEditedConfig((current) => {
      const draftConfig = current ?? baselineConfig;
      return {
        ...draftConfig,
        cleanup: { ...draftConfig.cleanup, enabled },
      };
    });
    await saveConfigQuietly(configToSave);
  };

  return {
    editedConfig,
    validationErrors,
    configSections,
    setConfigSections,
    isSaving,
    isConfigDirty,
    handleConfigChange,
    handleSave,
    handleReset,
    handleDownloadToggle,
    handleCleanupToggle,
  };
}
