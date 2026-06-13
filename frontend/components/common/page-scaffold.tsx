"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/navbar";
import { PageTransition } from "@/components/common/page-transition";

interface PageScaffoldProps {
  title: string;
  eyebrow: string;
  icon: LucideIcon;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
}

export function PageScaffold({
  title,
  eyebrow,
  icon,
  description,
  actions,
  meta,
  children,
}: PageScaffoldProps) {
  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          icon={icon}
          actions={actions}
          meta={meta}
        />
        {children}
      </div>
    </PageTransition>
  );
}
