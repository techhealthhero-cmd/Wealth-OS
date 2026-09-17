"use client";

import { useState } from "react";

import type { IncomeTarget } from "@/types/database";
import { useTranslation } from "@/i18n/client";
import { formatMoneyFromDecimal } from "@/lib/financial/money";
import { formatFriendlyDate } from "@/lib/transaction-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IncomeTargetForm } from "./income-target-form";

/**
 * Same "summary card + edit toggle" pattern `EmergencyFundView` already
 * established for a single per-user settings object — the income target
 * form was previously always rendered open, even after a successful save,
 * which read as "it doesn't go away" on a real device.
 */
export function IncomeTargetView({ target }: { target: IncomeTarget | null }) {
  const { t, locale } = useTranslation();
  const [editing, setEditing] = useState(!target);

  if (editing || !target) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("earn.target.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <IncomeTargetForm
            target={target}
            onSuccess={() => setEditing(false)}
            onCancel={target ? () => setEditing(false) : undefined}
          />
        </CardContent>
      </Card>
    );
  }

  const rows: { label: string; value: string }[] = [];
  if (target.target_date) {
    rows.push({
      label: t("earn.target.targetDate"),
      value: formatFriendlyDate(target.target_date, locale, {
        today: t("transactions.today"),
        yesterday: t("transactions.yesterday"),
      }),
    });
  }
  if (target.max_hours_per_week) {
    rows.push({
      label: t("earn.target.maxHoursPerWeek"),
      value: `${Number(target.max_hours_per_week)} ${t("earn.skills.hoursPerWeekUnit")}`,
    });
  }
  if (target.preferred_income_type !== "any") {
    rows.push({ label: t("earn.target.preferredIncomeType"), value: t(`earn.target.preferredTypes.${target.preferred_income_type}`) });
  }
  if (target.work_mode_preference !== "any") {
    rows.push({ label: t("earn.target.workModePreference"), value: t(`earn.target.workModes.${target.work_mode_preference}`) });
  }
  if (target.max_startup_cost) {
    rows.push({ label: t("earn.target.maxStartupCost"), value: formatMoneyFromDecimal(target.max_startup_cost) });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("earn.target.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{t("earn.target.targetMonthlyIncome")}</p>
          <p className="text-2xl font-bold">
            {target.target_monthly_income ? formatMoneyFromDecimal(target.target_monthly_income) : "—"}
            <span className="text-sm font-normal text-muted-foreground"> {t("earn.target.perMonth")}</span>
          </p>
          {target.desired_extra_income ? (
            <p className="text-sm text-muted-foreground">
              {t("earn.target.desiredExtraIncome")}: {formatMoneyFromDecimal(target.desired_extra_income)}
            </p>
          ) : null}
        </div>

        {rows.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t pt-3 text-sm">
            {rows.map((row) => (
              <div key={row.label} className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">{row.label}</p>
                <p className="truncate font-medium">{row.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          {t("common.edit")}
        </Button>
      </CardContent>
    </Card>
  );
}
