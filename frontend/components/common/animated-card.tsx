/**
 * AnimatedCard - Framer Motion 动画卡片
 * 提供hover缩放和阴影效果的卡片组件
 */

"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { ReactNode } from "react";

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function AnimatedCard({ children, className, onClick }: AnimatedCardProps) {
  return (
    <motion.div
      whileHover={{
        y: -2,
        boxShadow: "6px 6px 0px 0px rgba(0,0,0,1)",
        transition: { duration: 0.1 },
      }}
      whileTap={{
        y: 2,
        boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)",
        transition: { duration: 0.1 },
      }}
    >
      <Card className={className} onClick={onClick}>
        {children}
      </Card>
    </motion.div>
  );
}
