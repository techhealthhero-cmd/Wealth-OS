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

  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        <p className="text-sm font-medium text-muted-foreground">{t("earn.gap.title")}</p>
        {gap.achieved ? (
          <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{t("earn.gap.achieved")}</p>
        ) : (
          <p className="text-2xl font-bold">
            {t("earn.gap.remaining")} {formatMoney(gap.gapCents ?? 0)} {t("earn.gap.perMonth")}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          {formatMoney(averageMonthlyIncomeCents)} / {formatMoney(gap.targetMonthlyIncomeCents ?? 0)}
        </p>
      </CardContent>
    </Card>
  );
}
