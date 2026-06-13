"use client";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Fieldset, FieldsetLegend } from "@/components/ui/fieldset";
import { Separator } from "@/components/ui/separator";
import {
  NumericField,
  SectionHeader,
  TextField,
} from "@/components/pilot/config-fields";
import type { ConfigValidationErrors } from "@/lib/pilot-validation";
import type { RuleConfig } from "@/lib/types";

interface DownloadRulesSectionProps {
  rules: RuleConfig;
  errors: ConfigValidationErrors;
  onUpdate: (key: string, value: unknown, changedFieldId?: string) => void;
}

function parseKeywordList(value: string) {
  return value
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

export function DownloadRulesSection({
  rules,
  errors,
  onUpdate,
}: DownloadRulesSectionProps) {
  return (
    <AccordionItem value="download-rules">
      <div className="px-4">
        <AccordionTrigger className="py-4">
          <SectionHeader title="筛选规则" />
        </AccordionTrigger>
      </div>
      <AccordionContent className="px-4 pb-5">
        <div className="space-y-6">
          <Fieldset className="space-y-4">
            <FieldsetLegend>体积和活跃度</FieldsetLegend>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <NumericField
                id="min-size"
                label="最小体积（GB）"
                min={0}
                step={0.1}
                value={rules.min_size_gb}
                onChange={(value) => onUpdate("min_size_gb", value, "min-size")}
                error={errors["min-size"]}
              />
              <NumericField
                id="max-size"
                label="最大体积（GB）"
                min={0}
                step={0.1}
                value={rules.max_size_gb}
                onChange={(value) => onUpdate("max_size_gb", value, "max-size")}
                error={errors["max-size"]}
              />
              <NumericField
                id="max-seeders"
                label="最大做种数"
                min={0}
                value={rules.max_seeders}
                onChange={(value) =>
                  onUpdate("max_seeders", value, "max-seeders")
                }
                description="0 表示不限制"
                error={errors["max-seeders"]}
              />
              <NumericField
                id="min-leechers"
                label="最小下载数"
                min={0}
                value={rules.min_leechers}
                onChange={(value) =>
                  onUpdate("min_leechers", value, "min-leechers")
                }
                error={errors["min-leechers"]}
              />
            </div>
          </Fieldset>

          <Separator />

          <Fieldset className="space-y-4">
            <FieldsetLegend>关键词</FieldsetLegend>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="include-keywords"
                label="包含关键词"
                placeholder="movie, series…"
                value={rules.include_keywords.join(", ")}
                onChange={(value) =>
                  onUpdate(
                    "include_keywords",
                    parseKeywordList(value),
                    "include-keywords",
                  )
                }
                error={errors["include-keywords"]}
              />
              <TextField
                id="exclude-keywords"
                label="排除关键词"
                placeholder="AUDIOBOOK…"
                value={rules.exclude_keywords.join(", ")}
                onChange={(value) =>
                  onUpdate(
                    "exclude_keywords",
                    parseKeywordList(value),
                    "exclude-keywords",
                  )
                }
                error={errors["exclude-keywords"]}
              />
            </div>
          </Fieldset>

          <Separator />

          <Fieldset className="space-y-4">
            <FieldsetLegend>评分权重</FieldsetLegend>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <NumericField
                id="weight-size"
                label="体积权重"
                min={-10}
                max={10}
                step={0.1}
                value={rules.weight_size}
                onChange={(value) =>
                  onUpdate("weight_size", value, "weight-size")
                }
                error={errors["weight-size"]}
              />
              <NumericField
                id="weight-free-time"
                label="免费时长权重"
                min={-10}
                max={10}
                step={0.1}
                value={rules.weight_free_time}
                onChange={(value) =>
                  onUpdate("weight_free_time", value, "weight-free-time")
                }
                error={errors["weight-free-time"]}
              />
              <NumericField
                id="weight-age"
                label="发布时间权重"
                min={-10}
                max={10}
                step={0.1}
                value={rules.weight_age}
                onChange={(value) => onUpdate("weight_age", value, "weight-age")}
                error={errors["weight-age"]}
              />
              <NumericField
                id="weight-seeders"
                label="做种数权重"
                min={-10}
                max={10}
                step={0.1}
                value={rules.weight_seeders}
                onChange={(value) =>
                  onUpdate("weight_seeders", value, "weight-seeders")
                }
                error={errors["weight-seeders"]}
              />
            </div>
          </Fieldset>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
