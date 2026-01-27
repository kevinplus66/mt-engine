import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 border-2 border-black bg-white px-3 py-2 font-mono text-sm transition-all outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-mono file:font-medium",
        "focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
        "dark:bg-zinc-900 dark:border-white dark:text-white dark:focus:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.8)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
