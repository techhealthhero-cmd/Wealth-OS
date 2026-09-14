import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ManageBillingButton } from "@/features/billing/components/manage-billing-button";
import { CancelResumeButton } from "@/features/billing/components/cancel-resume-button";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Subscription } from "@/types/database";
import { toLocalDateString } from "@/lib/date";

interface BillingStatusCardProps {
  plan: PlanId;
  subscription: Subscription | null;
  usedThisMonth: number;
  aiLimit: number;
  resetDate: string;
  dict: Dictionary;
}

/**
 * STEP 13 — Billing section content (rendered both on `/billing` in full,
 * and summarized on `/profile`). Never shows a raw provider id, raw price
 * id, or internal status enum value to the user — every status maps to a
 * localized label (STEP 20 explicitly calls this out as a QA check).
 */
export function BillingStatusCard({ plan, subscription, usedThisMonth, aiLimit, resetDate, dict }: BillingStatusCardProps) {
  const definition = PLANS[plan];
  const statusLabel = subscription ? dict.billing.status[subscription.status] : dict.billing.status.free;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{dict.billing.currentPlan}</CardTitle>
          <Badge variant={plan === "free" ? "outline" : "default"}>{definition.displayName}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">{dict.billing.status.label}</p>
            <p className="font-medium">{statusLabel}</p>
          </div>
          {subscription?.current_period_end ? (
            <div>
              <p className="text-muted-foreground">
                {subscription.cancel_at_period_end ? dict.billing.endsOn : dict.billing.renewsOn}
              </p>
              <p className="font-medium">{toLocalDateString(new Date(subscription.current_period_end))}</p>
            </div>
          ) : null}
          <div>
            <p className="text-muted-foreground">{dict.aiCoach.usageLabel}</p>
            <p className="font-medium">
              {usedThisMonth}/{aiLimit} · {dict.billing.resetsOn} {resetDate}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {plan === "free" ? (
            <Button nativeButton={false} render={<Link href="/pricing" />} size="sm">
              {dict.billing.upgradeCta}
            </Button>
          ) : (
            <>
              <ManageBillingButton />
              {subscription?.provider_subscription_id ? (
                <CancelResumeButton cancelAtPeriodEnd={subscription.cancel_at_period_end} />
              ) : null}
              {plan !== "pro" ? (
                <Button nativeButton={false} render={<Link href="/pricing" />} size="sm" variant="outline">
                  {dict.billing.upgradeCta}
                </Button>
              ) : null}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
