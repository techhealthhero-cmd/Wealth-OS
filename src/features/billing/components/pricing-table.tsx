import { Check } from "lucide-react";

import { PLAN_IDS, PLANS, type PlanId } from "@/lib/billing/plans";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UpgradeButton } from "@/features/billing/components/upgrade-button";
import { formatMoney } from "@/lib/financial/money";
import type { Dictionary } from "@/i18n/dictionaries";

interface PricingTableProps {
  currentPlan: PlanId;
  dict: Dictionary;
}

/**
 * STEP 12 pricing page content. Monthly billing only — no annual price is
 * shown or implied anywhere here, since no annual plan exists (STEP 12:
 * "If annual billing not implemented, do not display fake annual
 * discounts.").
 */
export function PricingTable({ currentPlan, dict }: PricingTableProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {PLAN_IDS.map((planId) => {
        const plan = PLANS[planId];
        const isCurrent = planId === currentPlan;
        const featureKeys = dict.billing.pricing.featureList[planId] as string[];

        return (
          <Card key={planId} className={planId === "plus" ? "border-primary/40 shadow-sm" : undefined}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{plan.displayName}</CardTitle>
                {isCurrent ? (
                  <Badge variant="outline">{dict.billing.pricing.currentPlan}</Badge>
                ) : planId === "plus" ? (
                  <Badge variant="default">{dict.billing.pricing.recommended}</Badge>
                ) : null}
              </div>
              <p className="pt-1">
                <span className="text-2xl font-semibold">
                  {plan.priceThbPerMonth === 0 ? dict.billing.pricing.free : formatMoney(plan.priceThbPerMonth * 100)}
                </span>
                {plan.priceThbPerMonth > 0 ? (
                  <span className="text-sm text-muted-foreground">/{dict.billing.pricing.perMonth}</span>
                ) : null}
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ul className="space-y-2 text-sm">
                {featureKeys.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <Badge variant="outline" className="w-full justify-center py-2">
                  {dict.billing.pricing.currentPlan}
                </Badge>
              ) : planId === "free" ? null : (
                <UpgradeButton planId={planId} label={dict.billing.pricing.upgradeTo.replace("{plan}", plan.displayName)} variant={planId === "plus" ? "default" : "outline"} />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
