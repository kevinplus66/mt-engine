"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "p-0 group-data-[orientation=horizontal]/tabs:h-auto data-[variant=line]:p-0 group/tabs-list text-muted-foreground inline-flex w-fit items-center group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col border-2 border-black dark:border-white",
  {
    variants: {
      variant: {
        default: "bg-white dark:bg-zinc-900",
        line: "gap-2 bg-transparent border-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground relative inline-flex h-auto flex-1 items-center justify-center gap-1.5 border-r-2 border-black last:border-r-0 px-4 py-2 text-sm font-mono font-bold uppercase tracking-wider whitespace-nowrap transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start group-data-[orientation=vertical]/tabs:border-r-0 group-data-[orientation=vertical]/tabs:border-b-2 group-data-[orientation=vertical]/tabs:last:border-b-0 disabled:pointer-events-none disabled:opacity-50 group-data-[variant=default]/tabs-list:data-[state=active]:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:border-0 group-data-[variant=line]/tabs-list:data-[state=active]:border-2 group-data-[variant=line]/tabs-list:data-[state=active]:border-black dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-white",
        "data-[state=inactive]:bg-transparent data-[state=active]:bg-black data-[state=active]:text-white dark:border-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-black dark:group-data-[variant=default]/tabs-list:data-[state=active]:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)]",
        "group-data-[variant=line]/tabs-list:data-[state=inactive]:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-black group-data-[variant=line]/tabs-list:data-[state=active]:text-white dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-white dark:group-data-[variant=line]/tabs-list:data-[state=active]:text-black",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
