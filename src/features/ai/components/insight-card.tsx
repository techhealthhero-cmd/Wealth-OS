"use client";

import type { Insight } from "@/features/ai/lib/insights";
import { useTranslation } from "@/i18n/client";
import { formatMoney } from "@/lib/financial/money";
import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";

function insightText(insight: Insight, t: (key: string) => string): string {
  const label = t(`aiInsight.types.${insight.type}`);
  switch (insight.type) {
    case "spending_increase":
      return `${label} "${insight.categoryName ?? ""}" ${t("aiInsight.increasedBy")} ${insight.percent !== undefined ? `${insight.percent.toFixed(0)}%` : ""}`;
    case "savings_rate_drop":
      return `${label} ${insight.percent !== undefined ? `${Math.abs(insight.percent).toFixed(0)}%` : ""}`;
    case "debt_progress":
      return `${label} ${insight.amountCents !== undefined ? formatMoney(insight.amountCents) : ""}`;
    case "goal_ahead":
      return `"${insight.goalName ?? ""}" ${label}`;
    case "net_worth_growth":
      return `${label} ${insight.amountCents !== undefined ? formatMoney(insight.amountCents) : ""}`;
    default:
      return label;
  }
}

/**
 * Renders 0+ pre-computed insights (see `buildInsights` — zero LLM calls).
 * Deliberately no per-card dismiss/read state yet: insights are recomputed
 * fresh from real data on every load, so "already seen" isn't tracked.
 */
export function InsightCards({ insights }: { insights: Insight[] }) {
  const { t } = useTranslation();

  if (insights.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">{t("aiInsight.noInsight")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {insights.map((insight, i) => (
        <Card key={`${insight.type}-${i}`}>
          <CardContent className="flex items-start gap-2.5 pt-4 pb-4">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
            <p className="text-sm">{insightText(insight, t)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
