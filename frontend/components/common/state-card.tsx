import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StateCardProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  iconClassName?: string;
}

export function StateCard({
  title,
  description,
  icon: Icon,
  children,
  className,
  contentClassName,
  iconClassName,
}: StateCardProps) {
  return (
    <Card className={className}>
      <Empty className={contentClassName}>
        <EmptyHeader>
          {Icon && (
            <EmptyMedia variant="icon">
              <Icon className={cn("size-5", iconClassName)} aria-hidden="true" />
            </EmptyMedia>
          )}
          <EmptyTitle>{title}</EmptyTitle>
          {description && <EmptyDescription>{description}</EmptyDescription>}
        </EmptyHeader>
        {children}
      </Empty>
    </Card>
  );
}

export function MessageCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card>
      <CardContent className={cn("p-6 text-center", className)}>
        {children}
      </CardContent>
    </Card>
  );
}
