"use client";

import { useEffect, useRef, useState } from "react";
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
  const savedConfigRef = useRef<AutomationConfig | null>(null);
  const editedConfigRef = useRef<AutomationConfig | null>(null);
  const pendingQuickSaveConfigRef = useRef<AutomationConfig | null>(null);
  const quickSaveQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    if (!config) return;

    const previousSavedConfig = savedConfigRef.current;
    setSavedConfig(config);
    savedConfigRef.current = config;
    pendingQuickSaveConfigRef.current = null;
    setEditedConfig((current) => {
      const nextConfig =
        !current ||
        !previousSavedConfig ||
        arePilotConfigsEqual(current, previousSavedConfig)
          ? config
          : current;
      editedConfigRef.current = nextConfig;
      return nextConfig;
    });
  }, [config]);

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
    editedConfigRef.current = nextConfig;
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
      savedConfigRef.current = configToSave;
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
      savedConfigRef.current = editedConfig;
      pendingQuickSaveConfigRef.current = null;
      setValidationErrors({});
      toast.success("配置保存成功");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    const currentConfig = savedConfigRef.current ?? config;
    if (currentConfig) {
      editedConfigRef.current = currentConfig;
      setEditedConfig(currentConfig);
      pendingQuickSaveConfigRef.current = null;
      setValidationErrors({});
      toast.success("已重置为当前配置");
    }
  };

  const handleDownloadToggle = async (enabled: boolean) => {
    const baselineConfig =
      editedConfigRef.current ??
      pendingQuickSaveConfigRef.current ??
      savedConfigRef.current ??
      config;
    if (!baselineConfig) return;

    const configToSave = {
      ...baselineConfig,
      download: { ...baselineConfig.download, enabled },
    };
    const draftConfig = editedConfigRef.current ?? baselineConfig;
    const nextEditedConfig = {
      ...draftConfig,
      download: { ...draftConfig.download, enabled },
    };

    pendingQuickSaveConfigRef.current = configToSave;
    editedConfigRef.current = nextEditedConfig;
    setEditedConfig(nextEditedConfig);
    const queuedSave = quickSaveQueueRef.current.then(() =>
      saveConfigQuietly(configToSave),
    );
    quickSaveQueueRef.current = queuedSave;
    await queuedSave;
  };

  const handleCleanupToggle = async (enabled: boolean) => {
    const baselineConfig =
      editedConfigRef.current ??
      pendingQuickSaveConfigRef.current ??
      savedConfigRef.current ??
      config;
    if (!baselineConfig) return;

    const configToSave = {
      ...baselineConfig,
      cleanup: { ...baselineConfig.cleanup, enabled },
    };
    const draftConfig = editedConfigRef.current ?? baselineConfig;
    const nextEditedConfig = {
      ...draftConfig,
      cleanup: { ...draftConfig.cleanup, enabled },
    };

    pendingQuickSaveConfigRef.current = configToSave;
    editedConfigRef.current = nextEditedConfig;
    setEditedConfig(nextEditedConfig);
    const queuedSave = quickSaveQueueRef.current.then(() =>
      saveConfigQuietly(configToSave),
    );
    quickSaveQueueRef.current = queuedSave;
    await queuedSave;
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
