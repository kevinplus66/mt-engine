/**
 * AnimatedButton - Framer Motion 动画按钮
 * 提供 hover 和 tap 动画效果的按钮组件
 */

"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { forwardRef } from "react";
import { type VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export const AnimatedButton = forwardRef<HTMLButtonElement, ButtonProps>(
  (props, ref) => {
    // Neo-Brutalism button already has press effect built-in
    // No need for additional scale animations
    return <Button ref={ref} {...props} />;
  }
);

AnimatedButton.displayName = "AnimatedButton";
