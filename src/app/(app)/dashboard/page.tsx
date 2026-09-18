import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

import { getDashboardData, getIncomeExpenseTrend } from "@/features/dashboard/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { SummaryCards } from "@/features/dashboard/components/summary-cards";
import { WealthOverview } from "@/features/dashboard/components/wealth-overview";
import { NetWorthHero } from "@/features/dashboard/components/net-worth-hero";
import { GoalProgressCard } from "@/features/dashboard/components/goal-progress-card";
import { IncomeVsExpenseChart, SpendingByCategoryChart, MonthlyDonutCard } from "@/features/dashboard/components/charts-lazy";
import { TransactionRow } from "@/features/transactions/components/transaction-row";
import { QuickAdd } from "@/features/transactions/components/quick-add";
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

export const metadata: Metadata = { title: "Dashboard — Wealth OS" };

export default async function DashboardPage() {
  const [data, profile, priority, topInsight, incomeExpenseTrend] = await Promise.all([
    getDashboardData(),
    getProfile(),
    FEATURES.ai ? getFinancialPriority() : Promise.resolve(null),
    FEATURES.ai ? getTopInsight() : Promise.resolve(null),
    getIncomeExpenseTrend(),
  ]);
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
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:space-y-6 md:pb-8">
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
          income/expense/cash-flow picture, goal progress, spending
          breakdown, and only then the deeper Wealth Score/Life Stage/
          Safe-to-Spend detail grid and recent activity. Nothing here
          changes what data is fetched or how it's calculated — this is a
          presentation-order change only.

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

      {/* Always-visible income/expense/transfer tiles — the same QuickAdd
          dialogs as the floating-action-button dropdown further down, just
          surfaced directly instead of behind a menu. */}
      <div className="motion-reveal motion-reveal-2">
        <QuickAdd accounts={data.accounts} categories={data.categories} variant="row" />
      </div>

      {data.hasMonthData ? (
        <div className="motion-reveal motion-reveal-3">
          <MonthlyDonutCard
            incomeCents={data.incomeCents}
            expensesCents={data.expensesCents}
            cashFlowCents={data.cashFlowCents}
            currencyCode={currencyCode}
            labels={{
              title: dict.dashboard.thisMonth,
              income: dict.dashboard.monthlyIncome,
              expenses: dict.dashboard.monthlyExpenses,
              remaining: dict.dashboard.remaining,
            }}
          />
        </div>
      ) : null}

      {FEATURES.ai ? (
        <div className="motion-reveal motion-reveal-4 space-y-3">
          <NextBestActionCard priority={priority} hasTransactionHistory={data.recentTransactions.length > 0} />
          {topInsight ? <InsightCards insights={[topInsight]} /> : null}
        </div>
      ) : null}

      <div className="motion-reveal motion-reveal-5 space-y-3">
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

      <div className="motion-reveal motion-reveal-6">
        <SummaryCards
          incomeCents={data.incomeCents}
          expensesCents={data.expensesCents}
          cashFlowCents={data.cashFlowCents}
          savingsRatePercent={data.savingsRatePercent}
          incomeChangePercent={data.incomeChangePercent}
          expensesChangePercent={data.expensesChangePercent}
          cashFlowChangePercent={data.cashFlowChangePercent}
          savingsRateChangePoints={data.savingsRateChangePoints}
          hasDataThisMonth={data.hasMonthData}
          currencyCode={currencyCode}
          accounts={data.accounts}
          categories={data.categories}
          labels={{
            income: dict.dashboard.monthlyIncome,
            expenses: dict.dashboard.monthlyExpenses,
            cashFlow: dict.dashboard.cashFlow,
            savingsRate: dict.dashboard.savingsRate,
            vsLastMonth: dict.dashboard.vsLastMonth,
            noDataTitle: dict.dashboard.noIncomeExpenseData,
            noDataHint: dict.dashboard.noDataThisMonthHint,
          }}
        />
      </div>

      <div className="motion-reveal motion-reveal-7 grid gap-4 lg:grid-cols-2">
        <IncomeVsExpenseChart
          data={incomeExpenseTrend.map((point) => ({
            month: new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { month: "short" }).format(
              point.monthDate
            ),
            incomeCents: point.incomeCents,
            expensesCents: point.expensesCents,
          }))}
          currencyCode={currencyCode}
        />
        <SpendingByCategoryChart data={data.spendingByCategory} currencyCode={currencyCode} />
      </div>

      <div className="motion-reveal motion-reveal-8 space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">{dict.dashboard.moreInsights}</h2>
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
      </div>

      <EngagementSummaryCard />

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
                {data.accounts.map((account) => (
                  <li key={account.id} className="flex items-center justify-between text-sm">
                    <span>{account.name}</span>
                    <span className="font-medium">
                      {formatMoneyFromDecimal(account.current_balance, account.currency_code)}
                    </span>
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
              data.recentTransactions.map((transaction) => (
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

      <QuickAdd accounts={data.accounts} categories={data.categories} />
    </div>
  );
}
