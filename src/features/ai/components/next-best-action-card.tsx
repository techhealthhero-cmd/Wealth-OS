"use client";

import Link from "next/link";

import type { PriorityTool } from "@/features/ai/types";
import { buildNextBestActionText } from "@/features/ai/lib/next-best-action";
import { useTranslation } from "@/i18n/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

/**
 * Deterministic — every word here comes from the i18n dictionary plus real
 * numbers already computed by the Financial Priority Engine (Day 3). No AI
 * call renders this card; the LLM only ever elaborates on it if the user
 * asks in chat. The actual text transformation lives in the pure, unit-
 * tested `buildNextBestActionText` — this component only renders it.
 */
export function NextBestActionCard({
  priority,
  hasTransactionHistory = true,
}: {
  priority: PriorityTool | null;
  /**
   * `priority === null` means "the engine found nothing urgent" — but for a
   * brand-new user with zero transactions that's not the same as "your
   * finances are healthy," it's "there's no real data yet to judge." Without
   * this distinction we'd fabricate confidence exactly where the product
   * shouldn't (see PRODUCT_OUTCOMES.md's "never fabricate confidence" rule).
   * Defaults to `true` so existing callers keep today's "healthy" message.
   */
  hasTransactionHistory?: boolean;
}) {
  const { t } = useTranslation();

  if (!priority) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm font-medium">{t("nextBestAction.title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasTransactionHistory ? t("priorityEngine.noPriorities") : t("priorityEngine.notEnoughData")}
          </p>
          {!hasTransactionHistory ? (
            <Button variant="outline" size="sm" className="mt-3" nativeButton={false} render={<Link href="/money/transactions" />}>
              {t("priorityEngine.notEnoughDataCta")}
              <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  const reason = t(`nextBestAction.reasons.${priority.priorityType}`);
  const { actionText, cta } = buildNextBestActionText(priority, t);

  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          {/* One-shot soft pulse (never looping) marking a freshly-rendered
              Next Best Action — see `.motion-pulse-once` in globals.css. */}
          <span className="motion-pulse-once size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          {t("nextBestAction.title")}
        </p>
        <p className="text-lg font-semibold">{actionText}</p>
        <p className="text-sm text-muted-foreground">{reason}</p>
        {cta ? (
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={cta} />}>
            {t("nextBestAction.viewDetails")}
            <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
