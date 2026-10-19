import { calendarMonth, todayInTimeZone } from "@/lib/date";
import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

import { getDashboardData, getIncomeExpenseTrend } from "@/features/dashboard/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { WealthOverview } from "@/features/dashboard/components/wealth-overview";
import { NetWorthHero } from "@/features/dashboard/components/net-worth-hero";
import { IncomeThisMonth } from "@/features/dashboard/components/income-this-month";
import { GoalProgressCard } from "@/features/dashboard/components/goal-progress-card";
import { DashboardDetailsToggle } from "@/features/dashboard/components/dashboard-details-toggle";
import { HomeQuickActions } from "@/features/dashboard/components/home-quick-actions";
import { HomeUpcomingTiles } from "@/features/dashboard/components/home-tiles";
import { HomeCushion } from "@/features/dashboard/components/home-cushion";
import { IncomeVsExpenseChart, SpendingByCategoryChart } from "@/features/dashboard/components/charts-lazy";
import { MonthlyDonutCard } from "@/features/dashboard/components/summary-visuals";
import { TransactionRow } from "@/features/transactions/components/transaction-row";
import { DailyInboxSection } from "@/features/capture/components/daily-inbox-section";
import { EmptyState } from "@/components/shared/empty-state";
import { WelcomeIllustration } from "@/components/illustrations";
import { Button } from "@/components/ui/button";
import { formatMoneyFromDecimal } from "@/lib/financial/money";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FEATURES } from "@/config/features";
import { getFinancialPriority } from "@/features/ai/tools";
import { getTopInsight } from "@/features/ai/lib/insights";
import { NextBestActionCard } from "@/features/ai/components/next-best-action-card";
import { InsightCards } from "@/features/ai/components/insight-card";
import { EngagementSummaryCard } from "@/features/engagement/components/engagement-summary-card";
import { ArrowRight } from "lucide-react";
import { isAccountPrivacyRedacted } from "@/features/account-privacy/account-redaction";
import { getPrivacyGate } from "@/features/account-privacy/gate";
import { AccountPrivacyPlaceholder } from "@/features/account-privacy/components/account-privacy-placeholder";

export const metadata: Metadata = { title: "Dashboard — Wealth OS" };

export default async function DashboardPage() {
  const privacyGate = await getPrivacyGate(["overview", "activity", "planning", "insights"]);
  if (privacyGate) {
    return <AccountPrivacyPlaceholder {...privacyGate} section="generic" />;
  }

  const profile = await getProfile();
  const today = todayInTimeZone(profile?.timezone ?? "Asia/Bangkok");
  const month = calendarMonth(today);
  const data = await getDashboardData(today);
  const currencyCode = profile?.currency_code ?? "THB";
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

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
    <div className="mx-auto w-full max-w-6xl space-y-4 pb-[calc(7rem+env(safe-area-inset-bottom))] md:space-y-6 md:pb-8">
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
      {/* 2026-10 freelancer redesign ("C — freelancer dashboard", owner-
          chosen): dark-green Net Worth hero with a sparkline of the real
          snapshots (links to /money/net-worth) → quick actions → money
          expected / tax jar (not built yet: honest "coming soon" tiles) →
          this month's income by source → cash cushion / left to spend.
          Each data section streams in its own Suspense boundary and catches
          its own load errors. */}
      <div className="motion-reveal motion-reveal-1">
        <Suspense fallback={<Skeleton className="h-[120px] w-full rounded-[20px]" />}>
          <NetWorthHero variant="compact" />
        </Suspense>
      </div>

      <div className="motion-reveal motion-reveal-2">
        <HomeQuickActions labels={dict.homeDash} />
      </div>

      {/* One-line "N items need review" nudge — the Daily Inbox itself
          lives on Money › Transactions (2026-10-11). Renders nothing when
          nothing is pending, so Home stays calm. No fallback skeleton: it's
          usually absent, and a flashing placeholder would be noise. */}
      <Suspense fallback={null}>
        <DailyInboxSection />
      </Suspense>

      <div className="motion-reveal motion-reveal-3">
        <HomeUpcomingTiles labels={dict.homeDash} />
      </div>

      <div className="motion-reveal motion-reveal-3">
        <Suspense fallback={<Skeleton className="h-72 w-full rounded-[20px]" />}>
          <IncomeThisMonth />
        </Suspense>
      </div>

      <div className="motion-reveal motion-reveal-4">
        <Suspense fallback={<Skeleton className="h-32 w-full rounded-[20px]" />}>
          <HomeCushion />
        </Suspense>
      </div>

      {FEATURES.ai ? (
        <Suspense fallback={<Skeleton className="h-28 w-full rounded-xl" />}>
          <DashboardRecommendations hasTransactionHistory={data.recentTransactions.length > 0} />
        </Suspense>
      ) : null}

      <div className="motion-reveal motion-reveal-5">
        <MonthlyDonutCard
          incomeCents={data.incomeCents}
          expensesCents={data.expensesCents}
          cashFlowCents={data.cashFlowCents}
          savingsRatePercent={data.savingsRatePercent}
          incomeChangePercent={data.incomeChangePercent}
          expensesChangePercent={data.expensesChangePercent}
          cashFlowChangePercent={data.cashFlowChangePercent}
          savingsRateChangePoints={data.savingsRateChangePoints}
          hasDataThisMonth={data.hasMonthData}
          dayOfMonth={month.dayOfMonth}
          daysInMonth={month.daysInMonth}
          currencyCode={currencyCode}
          accounts={data.accounts}
          categories={data.categories}
          labels={{
            title: dict.dashboard.monthTitle.replace(
              "{month}",
              new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { month: "long", timeZone: "UTC" }).format(month.monthDate)
            ),
            daysLeft: dict.dashboard.daysLeft,
            remaining: dict.dashboard.remaining,
            spentOverIncome: dict.dashboard.spentOverIncome,
            incomeShort: dict.dashboard.incomeShort,
            expensesShort: dict.dashboard.expensesShort,
            incomeMark: dict.dashboard.incomeMark,
            overIncome: dict.dashboard.overIncome,
            spendingBarLabel: dict.dashboard.spendingBarLabel,
            spendingBarOverLabel: dict.dashboard.spendingBarOverLabel,
            changeFromLastMonth: dict.dashboard.changeFromLastMonth,
            cashFlow: dict.dashboard.cashFlow,
            savingsRate: dict.dashboard.savingsRate,
            vsLastMonth: dict.dashboard.vsLastMonth,
            viewDetails: dict.dashboard2.viewDetails,
            noDataTitle: dict.dashboard.noIncomeExpenseData,
            noDataHint: dict.dashboard.noDataThisMonthHint,
          }}
        >
          <SpendingByCategoryChart data={data.spendingByCategory} currencyCode={currencyCode} embedded />
        </MonthlyDonutCard>
      </div>

      <div className="motion-reveal motion-reveal-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{dict.dashboard2.topGoal}</h2>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/plan/goals" />}>
            {dict.dashboard.viewAll}
            <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
        <Suspense fallback={<Skeleton className="h-32 w-full rounded-xl" />}>
          <GoalProgressCard />
        </Suspense>
      </div>

      <div className="motion-reveal motion-reveal-7">
        <Suspense fallback={<Skeleton className="h-28 w-full rounded-xl" />}>
          <EngagementSummaryCard />
        </Suspense>
      </div>

      <div className="motion-reveal motion-reveal-8">
        <DashboardDetailsToggle label={dict.dashboard.moreInsights}>
          <Suspense fallback={<Skeleton className="h-[240px] w-full rounded-xl" />}>
            <IncomeExpenseTrendSection locale={locale} currencyCode={currencyCode} />
          </Suspense>

          <Suspense
            fallback={
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            }
          >
            <WealthOverview />
          </Suspense>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-medium">{dict.dashboard.accountBalances}</h2>
                  <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/money/accounts" />}>
                    {dict.dashboard.viewAll}
                  </Button>
                </div>
                {data.accounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{dict.accounts.emptyState}</p>
                ) : (
                  <ul className="space-y-2">
                    {data.accounts.slice(0, 3).map((account) => (
                      <li key={account.id} className="flex items-center justify-between text-sm">
                        <span>{account.name}</span>
                        {!isAccountPrivacyRedacted(account) ? (
                          <span className="font-medium">
                            {formatMoneyFromDecimal(account.current_balance, account.currency_code)}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-1 pt-6">
                <div className="flex items-center justify-between pb-2">
                  <h2 className="font-medium">{dict.dashboard.recentTransactions}</h2>
                  <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/money/transactions" />}>
                    {dict.dashboard.viewAll}
                  </Button>
                </div>
                {data.recentTransactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{dict.transactions.emptyState}</p>
                ) : (
                  data.recentTransactions.slice(0, 3).map((transaction) => (
                    <TransactionRow
                      key={transaction.id}
                      transaction={transaction}
                      accounts={data.accounts}
                      categories={data.categories}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </DashboardDetailsToggle>
      </div>
    </div>
  );
}

/**
 * Recommendations fan out into several planning queries. Keeping them in
 * their own streaming boundary prevents that optional work from delaying
 * the monthly overview and the rest of the dashboard shell.
 */
async function DashboardRecommendations({ hasTransactionHistory }: { hasTransactionHistory: boolean }) {
  const [priority, topInsight] = await Promise.all([getFinancialPriority(), getTopInsight()]);

  return (
    <div className="motion-reveal motion-reveal-5 space-y-3">
      <NextBestActionCard priority={priority} hasTransactionHistory={hasTransactionHistory} />
      {topInsight ? <InsightCards insights={[topInsight]} /> : null}
    </div>
  );
}

/** The six-month chart is collapsed by default, so it must not hold up FCP. */
async function IncomeExpenseTrendSection({ locale, currencyCode }: { locale: "th" | "en"; currencyCode: string }) {
  const incomeExpenseTrend = await getIncomeExpenseTrend();
  const monthFormatter = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { month: "short" });

  return (
    <IncomeVsExpenseChart
      data={incomeExpenseTrend.map((point) => ({
        month: monthFormatter.format(point.monthDate),
        incomeCents: point.incomeCents,
        expensesCents: point.expensesCents,
      }))}
      currencyCode={currencyCode}
    />
  );
}
