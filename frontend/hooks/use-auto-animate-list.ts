"use client";

import { useEffect } from "react";
import type { RefObject } from "react";
import { autoAnimate } from "@formkit/auto-animate";

export function useAutoAnimateList(
  refs: Array<RefObject<HTMLElement | null>>,
  enabled: boolean,
  deps: readonly unknown[] = [],
) {
  useEffect(() => {
    if (!enabled) return;

    let controllers: Array<ReturnType<typeof autoAnimate>> = [];
    const getAnimationElements = () =>
      refs
        .map((ref) => ref.current)
        .filter((element): element is HTMLElement => Boolean(element));
    const destroyControllers = () => {
      controllers.forEach((controller) => controller.destroy?.());
      controllers = [];
    };

    if (typeof window.matchMedia !== "function") {
      controllers = getAnimationElements().map((element) =>
        autoAnimate(element),
      );
      return destroyControllers;
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotionPreference = () => {
      if (motionQuery.matches) {
        destroyControllers();
        return;
      }

      if (controllers.length === 0) {
        controllers = getAnimationElements().map((element) =>
          autoAnimate(element),
        );
      }
    };

    syncMotionPreference();
    motionQuery.addEventListener("change", syncMotionPreference);

    return () => {
      motionQuery.removeEventListener("change", syncMotionPreference);
      destroyControllers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);
}
