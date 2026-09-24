"use client";

import type { IncomeGapResult } from "@/lib/financial/income-gap";
import { useTranslation } from "@/i18n/client";
import { formatMoney } from "@/lib/financial/money";
import { Card, CardContent } from "@/components/ui/card";

export function IncomeGapCard({ gap, averageMonthlyIncomeCents }: { gap: IncomeGapResult; averageMonthlyIncomeCents: number }) {
  const { t } = useTranslation();

  if (!gap.hasTarget) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm font-medium">{t("earn.gap.title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("earn.dashboard.noTarget")}</p>
        </CardContent>
      </Card>
    );
  }

  // "highlight" — this is the single hero number of /earn and
  // /earn/income (see card.tsx's own doc comment: "reserved for the
  // single most important figure on a page"), only once there's a real
  // target/gap number to show — the "no target set" case above stays
  // plain default, same reasoning as net-worth-hero.tsx demoting to
  // default when there's no positive headline to highlight.
  return (
    <Card variant="highlight">
      <CardContent className="space-y-2 pt-6">
        <p className="text-sm font-medium text-primary-foreground/70">{t("earn.gap.title")}</p>
        {gap.achieved ? (
          <p className="text-lg font-semibold text-[#7FD6B2]">{t("earn.gap.achieved")}</p>
        ) : (
          <p className="text-2xl font-bold text-primary-foreground">
            {t("earn.gap.remaining")} {formatMoney(gap.gapCents ?? 0)} {t("earn.gap.perMonth")}
          </p>
        )}
        <p className="text-sm text-primary-foreground/60">
          {formatMoney(averageMonthlyIncomeCents)} / {formatMoney(gap.targetMonthlyIncomeCents ?? 0)}
        </p>
      </CardContent>
    </Card>
  );
}
