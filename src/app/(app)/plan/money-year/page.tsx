import type { Metadata } from "next";

import { getMoneyYearSummary, getQuarterlySummary } from "@/features/money-year/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { MoneyYearForm } from "@/features/money-year/components/money-year-form";
import { MoneyYearView } from "@/features/money-year/components/money-year-view";
import { YearSelector } from "@/features/money-year/components/year-selector";
import { EmptyState } from "@/components/shared/empty-state";
import { WelcomeIllustration } from "@/components/illustrations";

export const metadata: Metadata = { title: "Money Year — Wealth OS" };

interface MoneyYearPageProps {
  searchParams: Promise<{ year?: string }>;
}

export default async function MoneyYearPage({ searchParams }: MoneyYearPageProps) {
  const params = await searchParams;
  const year = params.year && /^\d{4}$/.test(params.year) ? Number(params.year) : new Date().getFullYear();

  const [summary, profile] = await Promise.all([getMoneyYearSummary(year), getProfile()]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  if (!summary) {
    return (
      <div className="space-y-4">
        <YearSelector year={year} />
        <div className="mx-auto max-w-lg py-4">
          <EmptyState
            illustration={<WelcomeIllustration size={140} />}
            title={dict.moneyYear.emptyTitle}
            description={dict.moneyYear.emptyState}
            action={<MoneyYearForm year={year} />}
          />
        </div>
      </div>
    );
  }

  const quarterSummaries = await Promise.all(
    summary.quarters.map((plan) => getQuarterlySummary(year, plan))
  );

  return (
    <div className="space-y-4">
      <YearSelector year={year} />
      <MoneyYearView
        year={year}
        metrics={summary.metrics}
        moneyYearId={summary.moneyYear.id}
        quarterSummaries={quarterSummaries}
        majorExpenses={summary.majorExpenses}
        existingQuarters={summary.quarters}
      />
    </div>
  );
}
