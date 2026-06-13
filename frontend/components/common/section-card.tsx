import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  headerClassName,
  contentClassName,
}: SectionCardProps) {
  const hasHeader = title || description || action;
  const hasContent = children !== undefined && children !== null;

  return (
    <Card className={className}>
      {hasHeader && (
        <CardHeader
          className={cn(
            "py-4 has-data-[slot=card-action]:grid-cols-[1fr_auto]",
            hasContent && "border-b",
            headerClassName
          )}
        >
          <div className="min-w-0">
            {title && <CardTitle className="text-sm">{title}</CardTitle>}
            {description && (
              <CardDescription className="mt-1">{description}</CardDescription>
            )}
          </div>
          {action && (
            <div data-slot="card-action" className="self-center justify-self-end">
              {action}
            </div>
          )}
        </CardHeader>
      )}
      {hasContent && (
        <CardContent className={contentClassName}>{children}</CardContent>
      )}
    </Card>
  );
}
