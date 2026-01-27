"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-200 group/switch inline-flex shrink-0 items-center border-2 border-black transition-all outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-6 data-[size=default]:w-12 data-[size=sm]:h-5 data-[size=sm]:w-10 dark:border-white dark:data-[state=checked]:bg-white dark:data-[state=unchecked]:bg-zinc-700",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-white pointer-events-none block border-2 border-black ring-0 transition-transform group-data-[size=default]/switch:size-5 group-data-[size=sm]/switch:size-4 data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-0 dark:bg-black dark:border-white dark:data-[state=checked]:bg-black dark:data-[state=unchecked]:bg-white"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
