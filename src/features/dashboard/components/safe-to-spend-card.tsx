"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import type { SafeToSpendComputation } from "@/features/safe-to-spend/queries";
import { useTranslation } from "@/i18n/client";
import { formatMoney } from "@/lib/financial/money";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SafeToSpendCard({ computation }: { computation: SafeToSpendComputation }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (!computation.hasCompleteData || !computation.result) {
    return (
      <Card className="col-span-2 lg:col-span-1">
        <CardContent className="space-y-1 pt-6">
          <p className="text-sm text-muted-foreground">{t("dashboard2.safeToSpend")}</p>
          <p className="text-sm text-muted-foreground">{t("safeToSpend.incompleteDataHint")}</p>
        </CardContent>
      </Card>
    );
  }

  const { result } = computation;
  const rows: [string, number][] = [
    [t("safeToSpend.availableCash"), result.breakdown.availableLiquidCents],
    [t("safeToSpend.upcomingBills"), -result.breakdown.upcomingBillsCents],
    [t("safeToSpend.minimumDebtPayments"), -result.breakdown.minimumDebtPaymentsCents],
    [t("safeToSpend.plannedSavings"), -result.breakdown.plannedSavingsCents],
    [t("safeToSpend.plannedInvestment"), -result.breakdown.plannedInvestmentCents],
    [t("safeToSpend.protectedEmergencyFund"), -result.breakdown.protectedEmergencyFundCents],
    [t("safeToSpend.mandatoryCommitments"), -result.breakdown.mandatoryCommitmentsCents],
  ];

  return (
    <Card className="col-span-2 lg:col-span-1">
      <CardContent className="space-y-1 pt-6">
        <p className="text-sm text-muted-foreground">{t("dashboard2.safeToSpend")}</p>
        <p className="text-2xl font-bold">{formatMoney(result.todayCents)}</p>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>
            {t("safeToSpend.thisWeek")}: {formatMoney(result.thisWeekCents)}
          </span>
          <span>
            {t("safeToSpend.thisMonth")}: {formatMoney(result.thisMonthCents)}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 pt-1 text-xs font-medium text-primary"
        >
          {t("safeToSpend.howCalculated")}
          <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
        </button>

        {expanded ? (
          <div className="space-y-1 border-t pt-2 text-xs">
            {rows.map(([label, cents]) => (
              <div key={label} className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span>
                  {cents >= 0 ? "+" : ""}
                  {formatMoney(cents)}
                </span>
              </div>
            ))}
            <div className="flex justify-between border-t pt-1 font-medium">
              <span>{t("safeToSpend.discretionary")}</span>
              <span>{formatMoney(result.discretionaryCents)}</span>
            </div>
            <p className="pt-1 text-muted-foreground">{t("safeToSpend.estimateDisclaimer")}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
