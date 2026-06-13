"use client";

import { useEffect, useRef } from "react";
import { useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

interface NumberTickerProps {
  value: number;
  className?: string;
}

export function NumberTicker({ value, className }: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Initialize with the current value
  const motionValue = useMotionValue(value);

  // Spring configuration for smooth but snappy transition
  const springValue = useSpring(motionValue, {
    damping: 30,
    stiffness: 100,
    mass: 1,
  });

  // Update motion value when prop changes for animated users.
  useEffect(() => {
    if (!shouldReduceMotion) {
      motionValue.set(value);
    }
  }, [shouldReduceMotion, value, motionValue]);

  // Snap directly to the target value for reduced-motion users.
  useEffect(() => {
    if (shouldReduceMotion && ref.current) {
      ref.current.textContent = Math.round(value).toString();
    }
  }, [shouldReduceMotion, value]);

  // Subscribe to animated updates unless the user prefers reduced motion.
  useEffect(() => {
    if (shouldReduceMotion) {
      return;
    }

    const unsubscribe = springValue.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = Math.round(latest).toString();
      }
    });
    return unsubscribe;
  }, [springValue, shouldReduceMotion]);

  return (
    <span
      ref={ref}
      className={cn("inline-block tabular-nums", className)}
    >
      {value}
    </span>
  );
}
