import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getMoneyYears, getMoneyYearSummary, type MoneyYearSummary } from "@/features/money-year/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { requireFeature, FEATURES } from "@/lib/billing/entitlements";
import { LockedFeatureCard } from "@/features/billing/components/locked-feature-card";
import { MoneyYearCompareView } from "@/features/money-year/components/money-year-compare-view";
import { EmptyState } from "@/components/shared/empty-state";
import { WelcomeIllustration } from "@/components/illustrations";

export const metadata: Metadata = { title: "Compare Money Years — Wealth OS" };

/** Keeps the comparison table (and its Promise.all fan-out) from growing unbounded as a user accumulates years of history — most-recent-first, per getMoneyYears()'s own ordering. */
const MAX_YEARS_COMPARED = 5;

export default async function MoneyYearComparePage() {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  const gate = await requireFeature(FEATURES.MONEY_YEAR_COMPARE);
  if (!gate.allowed) {
    return (
      <div className="mx-auto max-w-lg py-8">
        <LockedFeatureCard
          title={dict.billing.locked.moneyYearCompareTitle}
          description={dict.billing.locked.moneyYearCompareDescription}
          ctaLabel={dict.billing.upgradeCta}
        />
      </div>
    );
  }

  const allYears = await getMoneyYears();
  const years = allYears.slice(0, MAX_YEARS_COMPARED).map((my) => my.year);
  const summaries = await Promise.all(years.map((y) => getMoneyYearSummary(y)));
  const validSummaries = summaries.filter((s): s is MoneyYearSummary => s !== null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/plan/money-year"
          aria-label={dict.common.back}
          className="rounded-full p-1.5 hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
        <h1 className="text-lg font-semibold">{dict.moneyYear.compareTitle}</h1>
      </div>

      {validSummaries.length < 2 ? (
        <div className="mx-auto max-w-lg py-4">
          <EmptyState
            illustration={<WelcomeIllustration size={140} />}
            title={dict.moneyYear.compareEmptyTitle}
            description={dict.moneyYear.compareEmptyState}
          />
        </div>
      ) : (
        <MoneyYearCompareView summaries={validSummaries} />
      )}
    </div>
  );
}
