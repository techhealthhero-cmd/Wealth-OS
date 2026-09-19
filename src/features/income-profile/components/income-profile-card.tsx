"use client";

import type { IncomeProfile } from "@/lib/financial/income-profile";
import { hasIncomeConcentrationRisk } from "@/lib/financial/income-profile";
import { useTranslation } from "@/i18n/client";
import { formatMoney } from "@/lib/financial/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STABILITY_BADGE_CLASS: Record<string, string> = {
  stable: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  mixed: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
  variable: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  unknown: "bg-muted text-muted-foreground",
};

export function IncomeProfileCard({ profile }: { profile: IncomeProfile }) {
  const { t } = useTranslation();
  const concentrationRisk = hasIncomeConcentrationRisk(profile);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between space-y-0">
        <CardTitle className="text-base">{t("earn.income.profile.title")}</CardTitle>
        <Badge className={STABILITY_BADGE_CLASS[profile.stability]}>
          {t(`earn.income.stabilityRatings.${profile.stability}`)}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">{t("earn.income.profile.currentMonthly")}</p>
            <p className="font-medium">{formatMoney(profile.currentMonthlyIncomeCents)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("earn.income.profile.averageMonthly")}</p>
            <p className="font-medium">{formatMoney(profile.averageMonthlyIncomeCents)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("earn.income.profile.activeSources")}</p>
            <p className="font-medium">{profile.activeSourceCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("earn.income.profile.stableIncome")}</p>
            <p className="font-medium">{formatMoney(profile.stableIncomeCents)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("earn.income.profile.variableIncome")}</p>
            <p className="font-medium">{formatMoney(profile.variableIncomeCents)}</p>
          </div>
          {profile.momGrowthPercent !== null ? (
            <div>
              <p className="text-muted-foreground">{t("earn.income.profile.momGrowth")}</p>
              <p className={`font-medium ${profile.momGrowthPercent < 0 ? "text-destructive" : ""}`}>
                {profile.momGrowthPercent >= 0 ? "+" : ""}
                {profile.momGrowthPercent.toFixed(1)}%
              </p>
            </div>
          ) : null}
        </div>

        {profile.primarySource ? (
          <div className="text-sm">
            <p className="text-muted-foreground">{t("earn.income.profile.primarySource")}</p>
            <p className="font-medium">
              {profile.primarySource}
              {profile.concentrationPercent !== null ? ` (${profile.concentrationPercent.toFixed(0)}%)` : ""}
            </p>
          </div>
        ) : null}

        {concentrationRisk ? (
          <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            {t("earn.income.profile.concentrationRisk")}
          </p>
        ) : null}

        {!profile.hasIncomeHistory ? (
          <p className="text-sm text-muted-foreground">{t("earn.income.profile.noHistory")}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
