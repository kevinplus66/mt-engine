"use client";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SectionHeader } from "@/components/pilot/config-fields";

interface NotificationSectionProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function NotificationSection({
  enabled,
  onChange,
}: NotificationSectionProps) {
  return (
    <AccordionItem value="notifications">
      <div className="px-4">
        <AccordionTrigger className="py-4">
          <SectionHeader title="通知设置" />
        </AccordionTrigger>
      </div>
      <AccordionContent className="px-4 pb-5">
        <div className="flex items-center gap-3">
          <Switch
            id="notification-enabled"
            checked={enabled}
            onCheckedChange={onChange}
          />
          <Label htmlFor="notification-enabled">微信通知</Label>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
