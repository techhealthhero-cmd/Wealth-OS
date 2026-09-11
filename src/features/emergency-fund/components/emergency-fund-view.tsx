"use client";

import { useState } from "react";

import type { Account, EmergencyFund, FinancialGoal } from "@/types/database";
import { useTranslation } from "@/i18n/client";
import { formatMoney } from "@/lib/financial/money";
import {
  calculateEmergencyFundCompletion,
  calculateEmergencyFundProgress,
  calculateEmergencyFundTarget,
  calculateMonthsProtected,
} from "@/lib/financial/emergency-fund";
import { EmergencyFundForm } from "./emergency-fund-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface EmergencyFundViewProps {
  emergencyFund: EmergencyFund | null;
  essentialMonthlyExpensesCents: number;
  hasEssentialData: boolean;
  accounts: Account[];
  goals: FinancialGoal[];
}

export function EmergencyFundView({
  emergencyFund,
  essentialMonthlyExpensesCents,
  hasEssentialData,
  accounts,
  goals,
}: EmergencyFundViewProps) {
  const { t, locale } = useTranslation();
  const [editing, setEditing] = useState(!emergencyFund);

  if (editing) {
    return (
      <div className="space-y-4">
        {!hasEssentialData ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              {t("emergencyFund.essentialExpensesMissing")}
            </CardContent>
          </Card>
        ) : null}
        <EmergencyFundForm emergencyFund={emergencyFund} accounts={accounts} goals={goals} />
      </div>
    );
  }

  const currentCents = Number(emergencyFund!.current_amount) * 100;
  const targetMonths = emergencyFund!.target_months ? Number(emergencyFund!.target_months) : null;
  const customTargetCents = emergencyFund!.custom_target_amount
    ? Number(emergencyFund!.custom_target_amount) * 100
    : null;
  const targetCents = calculateEmergencyFundTarget(essentialMonthlyExpensesCents, targetMonths, customTargetCents);
  const monthsProtected = calculateMonthsProtected(currentCents, essentialMonthlyExpensesCents);
  const progress = calculateEmergencyFundProgress(currentCents, targetCents);
  const monthlyCents = Number(emergencyFund!.monthly_contribution) * 100;
  const completion = calculateEmergencyFundCompletion(currentCents, targetCents, monthlyCents);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6 text-center">
          <p className="text-sm text-muted-foreground">{t("emergencyFund.monthsProtected")}</p>
          <p className="text-3xl font-bold">
            {monthsProtected.toFixed(1)} <span className="text-lg font-normal text-muted-foreground">{t("emergencyFund.months")}</span>
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <p className="text-muted-foreground">{t("emergencyFund.current")}</p>
              <p className="font-medium">{formatMoney(currentCents)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("emergencyFund.target")}</p>
              <p className="font-medium">{formatMoney(targetCents)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("emergencyFund.remaining")}</p>
              <p className="font-medium">{formatMoney(Math.max(0, targetCents - currentCents))}</p>
            </div>
          </div>
          {completion ? (
            <p className="text-xs text-muted-foreground">
              {t("emergencyFund.estimatedCompletion")}:{" "}
              {new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { month: "long", year: "numeric" }).format(
                completion
              )}
            </p>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            {t("emergencyFund.edit")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
