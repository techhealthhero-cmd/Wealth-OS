import type { Metadata } from "next";

import { getBudgetSummary, toMonthKey } from "@/features/budget/queries";
import { getCategories } from "@/features/categories/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { BudgetForm } from "@/features/budget/components/budget-form";
import { BudgetView } from "@/features/budget/components/budget-view";
import { MonthSelector } from "@/features/budget/components/month-selector";
import { EmptyState } from "@/components/shared/empty-state";
import { BudgetIllustration } from "@/components/illustrations";

export const metadata: Metadata = { title: "Budget — Wealth OS" };

interface BudgetPageProps {
  searchParams: Promise<{ month?: string }>;
}

export default async function BudgetPage({ searchParams }: BudgetPageProps) {
  const params = await searchParams;
  const monthDate = params.month && /^\d{4}-\d{2}-\d{2}$/.test(params.month) ? new Date(`${params.month}T00:00:00`) : new Date();
  const monthKey = toMonthKey(monthDate);

  const [summary, categories, profile] = await Promise.all([
    getBudgetSummary(monthDate),
    getCategories("expense"),
    getProfile(),
  ]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  if (!summary) {
    return (
      <div className="space-y-4">
        <MonthSelector month={monthKey} />
        <div className="mx-auto max-w-lg py-4">
          <EmptyState
            illustration={<BudgetIllustration size={140} />}
            title={dict.budget.emptyTitle}
            description={dict.budget.emptyState}
            action={<BudgetForm month={monthKey} />}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <MonthSelector month={monthKey} />
      <BudgetView summary={summary} categories={categories} month={monthKey} />
    </div>
  );
}
