/**
 * AnimatedButton - Framer Motion 动画按钮
 * 提供 hover 和 tap 动画效果的按钮组件
 */

"use client";

import { Button, type ButtonProps } from "@/components/ui/button";
import { forwardRef } from "react";

export const AnimatedButton = forwardRef<HTMLButtonElement, ButtonProps>(
  (props, ref) => {
    return <Button ref={ref} {...props} />;
  }
);

AnimatedButton.displayName = "AnimatedButton";
