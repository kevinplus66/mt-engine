/**
 * PageTransition - Framer Motion 页面过渡动画
 * 提供统一的页面进入/退出动画
 */

"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={
        shouldReduceMotion
          ? undefined
          : {
              duration: 0.2,
              ease: [0.25, 0.1, 0.25, 1],
            }
      }
    >
      {children}
    </motion.div>
  );
}
