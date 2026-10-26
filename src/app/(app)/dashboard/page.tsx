import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

import { getDashboardData, getTransactionYears } from "@/features/dashboard/queries";
import { YearPicker } from "@/features/dashboard/components/year-picker";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { NetWorthHero } from "@/features/dashboard/components/net-worth-hero";
import { CategorySpendingList, MonthlyNetBars } from "@/features/dashboard/components/year-details";
import { YearlyBalanceCard } from "@/features/dashboard/components/summary-visuals";
import { DailyInboxSection } from "@/features/capture/components/daily-inbox-section";
import { EmptyState } from "@/components/shared/empty-state";
import { WelcomeIllustration } from "@/components/illustrations";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FEATURES } from "@/config/features";
import { getFinancialPriority } from "@/features/ai/tools";
import { NextBestActionCard } from "@/features/ai/components/next-best-action-card";
import { getPrivacyGate } from "@/features/account-privacy/gate";
import { AccountPrivacyPlaceholder } from "@/features/account-privacy/components/account-privacy-placeholder";

export const metadata: Metadata = { title: "Dashboard — Wealth OS" };

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const privacyGate = await getPrivacyGate(["overview", "activity", "planning", "insights"]);
  if (privacyGate) {
    return <AccountPrivacyPlaceholder {...privacyGate} section="generic" />;
  }

  // ?year=2025 — the yearly card's year picker (2026-10-26). Anything that
  // isn't a selectable past year falls back to this year.
  const rawYear = (await searchParams).year;
  const currentYear = new Date().getFullYear();
  const requestedYear = Number(Array.isArray(rawYear) ? rawYear[0] : rawYear);
  const pickedYear =
    Number.isInteger(requestedYear) && requestedYear >= currentYear - 50 && requestedYear < currentYear ? requestedYear : currentYear;

  const [data, profile, years] = await Promise.all([
    getDashboardData({ year: pickedYear }),
    getProfile(),
    getTransactionYears(currentYear),
  ]);
  const currencyCode = profile?.currency_code ?? "THB";
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);
  // Same server-local clock getCurrentMonthRange() uses for "this month".
  const today = new Date();
  const dateLocale = locale === "th" ? "th-TH" : "en-US";
  const monthFormatter = new Intl.DateTimeFormat(dateLocale, { month: "short" });
  // "ปีนี้ · ม.ค. – ต.ค." for this year; "ปี 2568 · ทั้งปี" for a past one
  // (Thai counts in the Buddhist era; only the year number is shown).
  const yearRange = `${monthFormatter.format(new Date(data.year, 0, 1))} – ${monthFormatter.format(
    data.isPastYear ? new Date(data.year, 11, 1) : today
  )}`;
  const yearNumber =
    new Intl.DateTimeFormat(dateLocale, { year: "numeric" }).formatToParts(new Date(data.year, 6, 1)).find((p) => p.type === "year")
      ?.value ?? String(data.year);
  const yearTitle = (data.isPastYear ? dict.dashboard.year.pastTitle.replace("{year}", yearNumber) : dict.dashboard.year.title).replace(
    "{range}",
    yearRange
  );

  if (!data.hasAnyData) {
    return (
      <div className="mx-auto max-w-lg py-12">
        <EmptyState
          illustration={<WelcomeIllustration size={150} />}
          title={dict.dashboard.getStarted}
          description={dict.dashboard.emptyState}
          action={
            <Button nativeButton={false} render={<Link href="/money/accounts" />}>
              {dict.dashboard.getStarted}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-[calc(7rem+env(safe-area-inset-bottom))] md:space-y-6 md:pb-8">
      <div className="hidden min-w-0 md:block">
        {/* UX guidelines #6 (Home hierarchy): greeting/context leads the
            page, ahead of the section title — a personal "hello" reads
            as a coach checking in, not an admin-panel page header. Plan
            badge now lives in the shared app header (visible on every
            page), not duplicated here. */}
        <h1 className="truncate text-2xl font-semibold tracking-tight">
          {profile?.display_name
            ? dict.dashboard.greetingCompact.replace("{name}", profile.display_name)
            : dict.dashboard.greetingGenericCompact}
        </h1>
      </div>

      {/* UX reorg (2026-09): information hierarchy follows the "5 core
          questions" framework — Net Worth (am I wealthier?) first, Next
          Best Action (what should I do?) second, then the monthly
          income/expense/cash-flow picture, goal progress, and engagement.
          Nothing here changes what data is fetched or how it's calculated
          — this is a presentation-order change only.

          2026-09 "command center" redesign: everything beyond the above —
          trend chart, the deeper Wealth Score/Life Stage/Safe-to-Spend/Budget/
          Emergency Fund grid, and account/transaction previews — now lives
          behind one collapsed DashboardDetailsToggle instead of being part
          of the default scroll (see UX_GUIDELINES.md #4, progressive
          disclosure). Net Worth's own assets/liabilities breakdown and the
          monthly snapshot's cash-flow/savings-rate detail follow the same
          principle at the card level (chevron-expand, collapsed by
          default) rather than being separate always-visible cards.

          2026-09 motion pass: each section gets a small staggered
          fade+translateY entrance (`.motion-reveal*`, see globals.css) —
          a one-shot reveal, not a repeating effect, and automatically
          disabled under prefers-reduced-motion by the existing global kill
          switch. NetWorthHero/GoalProgressCard/WealthOverview are each
          independent async Server Components already (their own data
          fetches), so wrapping them in Suspense lets them stream in as
          soon as they're ready instead of all waiting on each other —
          real progressive loading, not just a CSS effect on already-
          resolved content. */}
      <div className="motion-reveal motion-reveal-1">
        <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
          <NetWorthHero />
        </Suspense>
      </div>

      {/* 2026-10-11: the income/expense/transfer tiles left Home — they live
          on Money › Transactions, and the center mic records from any page.
          Home is for the overview. */}

      {/* One-line "N items need review" nudge — the Daily Inbox itself
          lives on Money › Transactions (2026-10-11). Renders nothing when
          nothing is pending, so Home stays calm. No fallback skeleton: it's
          usually absent, and a flashing placeholder would be noise. */}
      <Suspense fallback={null}>
        <DailyInboxSection />
      </Suspense>

      <div className="motion-reveal motion-reveal-3">
        {/* 2026-10-24 (design H1): year-to-date income vs expenses as a
            compact card, kept quiet so Net Worth stays the one headline.
            Yearly because a once-a-year bill (insurance, car tax) made its
            month look like an overspend — explained at /help#yearly-view.
            Since 2026-10-26 everything in it is year to date: four year
            tiles, the monthly left-over bars, and every category's total. */}
        <YearlyBalanceCard
          yearIncomeCents={data.yearIncomeCents}
          yearExpensesCents={data.yearExpensesCents}
          yearSavingsRatePercent={data.yearSavingsRatePercent}
          hasYearData={data.hasYearData}
          rangeLabel={yearRange}
          currencyCode={currencyCode}
          accounts={data.accounts}
          categories={data.categories}
          titleSlot={
            <YearPicker
              title={yearTitle}
              years={years}
              selectedYear={data.year}
              currentYear={currentYear}
            />
          }
          labels={{
            ...dict.dashboard.year,
            income: dict.dashboard.incomeShort,
            expenses: dict.dashboard.expensesShort,
            remaining: dict.dashboard.remaining,
            savingsRate: dict.dashboard.savingsRate,
          }}
          yearChart={
            <MonthlyNetBars
              points={data.monthlyNet}
              monthLabels={Array.from({ length: 12 }, (_, i) => monthFormatter.format(new Date(data.year, i, 1)))}
              currencyCode={currencyCode}
              labels={{ noData: dict.dashboard.year.monthlyNetNoData }}
            />
          }
        >
          <CategorySpendingList
            rows={data.yearCategorySpending}
            locale={locale}
            currencyCode={currencyCode}
            transactionsHref={
              data.isPastYear ? `/money/transactions?from=${data.year}-01-01&to=${data.year}-12-31` : "/money/transactions"
            }
            labels={{
              title: dict.dashboard.year.whereMoneyWent,
              total: dict.dashboard.year.categoryTotal,
              uncategorized: dict.transactions.uncategorized,
              noSpending: dict.dashboard.year.noSpending,
              viewAll: dict.dashboard.year.viewAll,
            }}
          />
        </YearlyBalanceCard>
      </div>

      {FEATURES.ai ? (
        <Suspense fallback={<Skeleton className="h-28 w-full rounded-xl" />}>
          <DashboardRecommendations hasTransactionHistory={data.recentTransactions.length > 0} />
        </Suspense>
      ) : null}

      {/* 2026-10-26: Home ends at the Next Best Action. The insight card,
          top goal, streak/engagement card and the "More insights" drawer
          were removed — each already has its own page (Plan › Goals,
          Money › Transactions/Accounts, Plan › Forecast). */}
    </div>
  );
}

/**
 * Recommendations fan out into several planning queries. Keeping them in
 * their own streaming boundary prevents that optional work from delaying
 * the monthly overview and the rest of the dashboard shell.
 */
async function DashboardRecommendations({ hasTransactionHistory }: { hasTransactionHistory: boolean }) {
  const priority = await getFinancialPriority();

  return (
    <div className="motion-reveal motion-reveal-4">
      <NextBestActionCard priority={priority} hasTransactionHistory={hasTransactionHistory} />
    </div>
  );
}
