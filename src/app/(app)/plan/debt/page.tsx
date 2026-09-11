import type { Metadata } from "next";

import { getDebtPlannerSummary } from "@/features/debt-planner/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { DebtPlanForm } from "@/features/debt-planner/components/debt-plan-form";
import { DebtPlannerView } from "@/features/debt-planner/components/debt-planner-view";
import { EmptyState } from "@/components/shared/empty-state";
import { EmptyAccountsIllustration } from "@/components/illustrations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Debt Planner — Wealth OS" };

export default async function DebtPlannerPage() {
  const [summary, profile] = await Promise.all([getDebtPlannerSummary(), getProfile()]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  if (summary.liabilities.length === 0) {
    return (
      <div className="mx-auto max-w-lg py-8">
        <EmptyState
          illustration={<EmptyAccountsIllustration size={140} />}
          title={dict.debtPlanner.emptyTitle}
          description={dict.debtPlanner.emptyState}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{dict.debtPlanner.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <DebtPlanForm plan={summary.plan} />
        </CardContent>
      </Card>

      <DebtPlannerView liabilities={summary.liabilities} result={summary.result} />
    </div>
  );
}
