import { Check } from "lucide-react";

import { PLAN_IDS, PLANS, type PlanId } from "@/lib/billing/plans";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UpgradeButton } from "@/features/billing/components/upgrade-button";
import { formatMoney } from "@/lib/financial/money";
import { cn } from "@/lib/utils";
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
        const isHighlighted = planId === "plus";
        const featureKeys = dict.billing.pricing.featureList[planId] as string[];

        return (
          // Reskin v2.2 ("Coinest" light green direction): the recommended
          // tier gets the single "highlight" (deep green) card on this
          // page — every other tier stays a plain white card, matching the
          // 3-tier hierarchy used on the dashboard's Net Worth card.
          <Card key={planId} variant={isHighlighted ? "highlight" : "default"}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{plan.displayName}</CardTitle>
                {isCurrent ? (
                  <Badge
                    variant="outline"
                    className={isHighlighted ? "border-primary-foreground/30 text-primary-foreground" : undefined}
                  >
                    {dict.billing.pricing.currentPlan}
                  </Badge>
                ) : isHighlighted ? (
                  <Badge className="bg-accent-lime text-primary">{dict.billing.pricing.recommended}</Badge>
                ) : null}
              </div>
              <p className="pt-1">
                <span className="text-2xl font-semibold">
                  {plan.priceThbPerMonth === 0 ? dict.billing.pricing.free : formatMoney(plan.priceThbPerMonth * 100)}
                </span>
                {plan.priceThbPerMonth > 0 ? (
                  <span className={cn("text-sm", isHighlighted ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    /{dict.billing.pricing.perMonth}
                  </span>
                ) : null}
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ul className="space-y-2 text-sm">
                {featureKeys.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check
                      className={cn("mt-0.5 h-4 w-4 shrink-0", isHighlighted ? "text-accent-lime" : "text-primary")}
                      aria-hidden="true"
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <Badge
                  variant="outline"
                  className={cn("w-full justify-center py-2", isHighlighted && "border-primary-foreground/30 text-primary-foreground")}
                >
                  {dict.billing.pricing.currentPlan}
                </Badge>
              ) : planId === "free" ? null : (
                <UpgradeButton
                  planId={planId}
                  label={dict.billing.pricing.upgradeTo.replace("{plan}", plan.displayName)}
                  variant={isHighlighted ? "default" : "outline"}
                  className={isHighlighted ? "bg-primary-foreground text-primary hover:brightness-95" : undefined}
                />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
