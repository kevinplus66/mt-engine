/**
 * PageTransition - Framer Motion 页面过渡动画
 * 提供统一的页面进入/退出动画
 */

"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{
        duration: 0.2,
        ease: [0.25, 0.1, 0.25, 1], // Sharp easing for Neo-Brutalism
      }}
    >
      {children}
    </motion.div>
  );
}
