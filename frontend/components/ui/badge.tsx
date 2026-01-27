import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest border-2 w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-all overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white",
        secondary:
          "bg-gray-200 text-black border-black [a&]:hover:bg-gray-300 dark:bg-zinc-700 dark:text-white dark:border-white",
        destructive:
          "bg-red-600 text-white border-black [a&]:hover:bg-red-700 dark:border-white",
        outline:
          "border-black text-foreground bg-transparent [a&]:hover:bg-gray-100 dark:border-white dark:[a&]:hover:bg-zinc-800",
        ghost: "border-transparent [a&]:hover:bg-gray-100 [a&]:hover:border-black dark:[a&]:hover:bg-zinc-800 dark:[a&]:hover:border-white",
        link: "text-black underline-offset-4 border-transparent [a&]:hover:underline dark:text-white",
        // Semantic variants for the application
        success: "bg-green-500 text-white border-black dark:border-white",
        info: "bg-blue-500 text-white border-black dark:border-white",
        warning: "bg-yellow-500 text-black border-black dark:border-white",
        pilot: "bg-red-600 text-white border-black dark:border-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
