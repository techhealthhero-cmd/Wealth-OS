"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import type { WealthScoreComputation } from "@/features/wealth-score/queries";
import { useTranslation } from "@/i18n/client";
import { formatMoney } from "@/lib/financial/money";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const COMPONENT_KEYS = [
  ["cashFlow", "cashFlowScore"],
  ["savings", "savingsScore"],
  ["emergencyFund", "emergencyFundScore"],
  ["debtHealth", "debtHealthScore"],
  ["netWorthGrowth", "netWorthGrowthScore"],
  ["incomeGrowth", "incomeGrowthScore"],
  ["goalProgress", "goalProgressScore"],
] as const;

export function WealthScoreCard({ computation }: { computation: WealthScoreComputation }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { result, actions, hasNetWorthHistory, hasIncomeHistory } = computation;

  return (
    <Card className="col-span-2 lg:col-span-1">
      <CardContent className="space-y-1 pt-6">
        <p className="text-sm text-muted-foreground">{t("dashboard2.wealthScore")}</p>
        <p className="text-2xl font-bold">
          {result.totalScore.toFixed(0)}
          <span className="text-sm font-normal text-muted-foreground"> {t("wealthScore.outOf100")}</span>
        </p>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 pt-1 text-xs font-medium text-primary"
        >
          {t("dashboard2.viewDetails")}
          <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
        </button>

        {expanded ? (
          <div className="space-y-2 border-t pt-2 text-xs">
            {(!hasNetWorthHistory || !hasIncomeHistory) ? (
              <p className="text-muted-foreground">{t("wealthScore.newUserNote")}</p>
            ) : null}
            {COMPONENT_KEYS.map(([label, key]) => (
              <div key={key} className="flex justify-between">
                <span className="text-muted-foreground">{t(`wealthScore.components.${label}`)}</span>
                <span>{result[key].toFixed(0)}</span>
              </div>
            ))}

            {actions.length > 0 ? (
              <div className="space-y-1 border-t pt-2">
                <p className="font-medium">{t("wealthScore.improvementActions")}</p>
                {actions.map((action) => (
                  <p key={action.type} className="text-muted-foreground">
                    {t(`wealthScore.actions.${action.type}`)}
                    {action.amountCents !== undefined ? ` ${formatMoney(action.amountCents)}` : ""}
                    {action.targetPercent !== undefined ? ` ${action.targetPercent}%` : ""}
                    {action.goalName ? `: ${action.goalName}` : ""}
                  </p>
                ))}
              </div>
            ) : (
              <p className="border-t pt-2 text-muted-foreground">{t("wealthScore.noActionsNeeded")}</p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
