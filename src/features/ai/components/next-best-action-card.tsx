"use client";

import Link from "next/link";

import type { PriorityTool } from "@/features/ai/types";
import { buildNextBestActionText } from "@/features/ai/lib/next-best-action";
import { useTranslation } from "@/i18n/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconChip } from "@/components/shared/icon-chip";
import { ArrowRight, Sparkles } from "lucide-react";

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
      <Card variant="soft">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <IconChip icon={Sparkles} tone="mint" className="size-11" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t("nextBestAction.title")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasTransactionHistory ? t("priorityEngine.noPriorities") : t("priorityEngine.notEnoughData")}
              </p>
              {!hasTransactionHistory ? (
                <Button size="sm" className="mt-3" nativeButton={false} render={<Link href="/money/transactions" />}>
                  {t("priorityEngine.notEnoughDataCta")}
                  <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const reason = t(`nextBestAction.reasons.${priority.priorityType}`);
  const { actionText, cta } = buildNextBestActionText(priority, t);

  return (
    <Card variant="soft">
      <CardContent className="pt-6">
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 min-[375px]:grid-cols-[auto_minmax(0,1fr)_auto] min-[375px]:items-center">
          <IconChip icon={Sparkles} tone="mint" className="motion-pulse-once size-11" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{t("nextBestAction.title")}</p>
            <p className="mt-1 break-words text-base font-semibold leading-snug sm:text-lg">{actionText}</p>
            <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
          </div>
          {cta ? (
            <Button size="sm" className="col-span-2 w-full min-[375px]:col-span-1 min-[375px]:w-auto" nativeButton={false} render={<Link href={cta} />}>
              {t("nextBestAction.takeAction")}
              <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
