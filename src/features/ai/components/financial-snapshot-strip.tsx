"use client";

import type { FinancialSnapshotTool } from "@/features/ai/types";
import { useTranslation } from "@/i18n/client";
import { formatMoney } from "@/lib/financial/money";
import { Card, CardContent } from "@/components/ui/card";

/** Compact read-only recap shown above the chat — deterministic numbers only, same source as the dashboard. */
export function FinancialSnapshotStrip({ snapshot }: { snapshot: FinancialSnapshotTool }) {
  const { t } = useTranslation();

  if (!snapshot.hasAnyData) return null;

  return (
    <Card>
      <CardContent className="grid grid-cols-3 divide-x pt-4 pb-4 text-center">
        <div className="px-2">
          <p className="text-xs text-muted-foreground">{t("dashboard.monthlyIncome")}</p>
          <p className="text-sm font-semibold">{formatMoney(snapshot.incomeCents)}</p>
        </div>
        <div className="px-2">
          <p className="text-xs text-muted-foreground">{t("dashboard.monthlyExpenses")}</p>
          <p className="text-sm font-semibold">{formatMoney(snapshot.expensesCents)}</p>
        </div>
        <div className="px-2">
          <p className="text-xs text-muted-foreground">{t("dashboard.cashFlow")}</p>
          <p className={`text-sm font-semibold ${snapshot.cashFlowCents < 0 ? "text-destructive" : ""}`}>
            {formatMoney(snapshot.cashFlowCents)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
