"use client";

import { useTranslation } from "@/i18n/client";
import type { Liability } from "@/types/database";
import type { DebtPayoffResult } from "@/lib/financial/debt-planner";
import { formatMoney, formatMoneyFromDecimal } from "@/lib/financial/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface DebtPlannerViewProps {
  liabilities: Liability[];
  result: DebtPayoffResult;
}

export function DebtPlannerView({ liabilities, result }: DebtPlannerViewProps) {
  const { t, locale } = useTranslation();

  const liabilityById = new Map(liabilities.map((l) => [l.id, l]));
  const hasNeverPayoff = result.perLiability.some((p) => p.payoffMonth === null);

  const monthsFromNowLabel = (months: number | null) => {
    if (months === null) return "—";
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { month: "long", year: "numeric" }).format(
      date
    );
  };

  return (
    <div className="space-y-4">
      {/* "soft" — 4 equally-weighted stats, none the page's single hero
          figure, so the secondary-emphasis tier fits better than the
          strongest one (see card.tsx's own doc comment). */}
      <div className="grid grid-cols-2 gap-3">
        <Card variant="soft">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">{t("debtPlanner.monthsToDebtFree")}</p>
            <p className="text-xl font-semibold">{result.totalMonths ?? "—"}</p>
          </CardContent>
        </Card>
        <Card variant="soft">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">{t("debtPlanner.monthlyRequirement")}</p>
            <p className="text-xl font-semibold">{formatMoney(result.monthlyDebtRequirementCents)}</p>
          </CardContent>
        </Card>
        <Card variant="soft">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">{t("debtPlanner.totalInterestPaid")}</p>
            <p className="text-xl font-semibold text-destructive">{formatMoney(result.totalInterestPaidCents)}</p>
          </CardContent>
        </Card>
        <Card variant="soft">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">{t("debtPlanner.interestSaved")}</p>
            <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
              {formatMoney(result.totalInterestSavedCents)}
            </p>
          </CardContent>
        </Card>
      </div>

      {hasNeverPayoff ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t("debtPlanner.neverPaysOff")}</span>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("debtPlanner.payoffOrder")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.order.map((id, index) => {
            const liability = liabilityById.get(id);
            const summary = result.perLiability.find((p) => p.id === id);
            if (!liability || !summary) return null;
            return (
              <div key={id} className="flex items-center justify-between gap-2 border-b pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{liability.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatMoneyFromDecimal(liability.balance)}
                      {liability.interest_rate ? ` · ${Number(liability.interest_rate)}%` : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{monthsFromNowLabel(summary.payoffMonth)}</p>
                  <p className="text-xs text-muted-foreground">{formatMoney(summary.totalInterestPaidCents)}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">{t("debtPlanner.estimateDisclaimer")}</p>
    </div>
  );
}
