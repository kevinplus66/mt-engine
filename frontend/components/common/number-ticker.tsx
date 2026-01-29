"use client";

import { useEffect, useRef } from "react";
import { useMotionValue, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

interface NumberTickerProps {
  value: number;
  className?: string;
}

export function NumberTicker({ value, className }: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  
  // Initialize with the current value
  const motionValue = useMotionValue(value);
  
  // Spring configuration for smooth but snappy transition
  const springValue = useSpring(motionValue, {
    damping: 30,
    stiffness: 100,
    mass: 1,
  });

  // Update motion value when prop changes
  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  // Subscribe to updates
  useEffect(() => {
    const unsubscribe = springValue.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = Math.round(latest).toString();
      }
    });
    return unsubscribe;
  }, [springValue]);

  return (
    <span 
      ref={ref} 
      className={cn("inline-block tabular-nums", className)}
    >
      {value}
    </span>
  );
}
