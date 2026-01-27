import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-gray-200 dark:bg-zinc-700 animate-pulse border-2 border-black dark:border-white", className)}
      {...props}
    />
  )
}

export { Skeleton }
