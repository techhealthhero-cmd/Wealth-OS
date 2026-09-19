"use client";

import { useTransition } from "react";

import type { DetectedSubscription } from "@/types/database";
import { confirmSubscription, dismissSubscription, markSubscriptionCancelled } from "@/features/subscriptions/actions";
import { calculateAnnualizedCostCents } from "@/lib/financial/subscription-detector";
import { useTranslation } from "@/i18n/client";
import { formatMoneyFromDecimal, formatMoney, parseMoneyToCents } from "@/lib/financial/money";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CONFIDENCE_BADGE_CLASS: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  low: "bg-muted text-muted-foreground",
};

export function SubscriptionCard({ subscription }: { subscription: DetectedSubscription }) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();

  const annualizedCents = calculateAnnualizedCostCents(parseMoneyToCents(subscription.estimated_amount), subscription.frequency);

  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {/* leading-tight, not leading-none — see transaction-row.tsx's title for why (Thai tone-mark clipping). */}
              <p className="min-w-0 truncate font-medium leading-tight">{subscription.merchant}</p>
              <Badge className={cn("shrink-0", CONFIDENCE_BADGE_CLASS[subscription.confidence])}>
                {t(`subscriptions.confidences.${subscription.confidence}`)}
              </Badge>
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {t(`recurring.frequencies.${subscription.frequency}`)} · {t("subscriptions.occurrences")} {subscription.occurrence_count}{" "}
              {t("subscriptions.occurrencesUnit")}
              {subscription.next_expected_date ? ` · ${t("subscriptions.nextExpected")}: ${subscription.next_expected_date}` : ""}
            </p>
          </div>
          <p className="shrink-0 font-medium">{formatMoneyFromDecimal(subscription.estimated_amount)}</p>
        </div>

        <p className="text-xs text-muted-foreground">
          {t("subscriptions.annualizedCost")}: {formatMoney(annualizedCents)} — {t("subscriptions.annualizedCostDisclaimer")}
        </p>

        {subscription.status === "pending" ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => startTransition(async () => { await confirmSubscription(subscription.id); })}
            >
              {t("subscriptions.confirm")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => startTransition(async () => { await dismissSubscription(subscription.id); })}
            >
              {t("subscriptions.dismiss")}
            </Button>
          </div>
        ) : subscription.status === "confirmed" ? (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => startTransition(async () => { await markSubscriptionCancelled(subscription.id); })}
          >
            {t("subscriptions.markCancelled")}
          </Button>
        ) : (
          <Badge variant="secondary">{t(`subscriptions.statuses.${subscription.status}`)}</Badge>
        )}
      </CardContent>
    </Card>
  );
}
