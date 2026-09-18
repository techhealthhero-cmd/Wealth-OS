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
import { requireFeature, FEATURES } from "@/lib/billing/entitlements";
import { LockedFeatureCard } from "@/features/billing/components/locked-feature-card";

export const metadata: Metadata = { title: "Debt Planner — Wealth OS" };

export default async function DebtPlannerPage() {
  // requireFeature() doesn't depend on profile — perf audit finding: these
  // were sequential for no reason, each paying its own round-trip.
  const [profile, gate] = await Promise.all([getProfile(), requireFeature(FEATURES.DEBT_PLANNER)]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  if (!gate.allowed) {
    return (
      <div className="mx-auto max-w-lg py-8">
        <LockedFeatureCard
          title={dict.billing.locked.debtPlannerTitle}
          description={dict.billing.locked.debtPlannerDescription}
          ctaLabel={dict.billing.upgradeCta}
        />
      </div>
    );
  }

  const summary = await getDebtPlannerSummary();

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
