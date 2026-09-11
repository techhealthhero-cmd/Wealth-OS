import Link from "next/link";
import type { Metadata } from "next";

import { getDashboardData } from "@/features/dashboard/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { SummaryCards } from "@/features/dashboard/components/summary-cards";
import { WealthOverview } from "@/features/dashboard/components/wealth-overview";
import { IncomeVsExpenseChart, SpendingByCategoryChart } from "@/features/dashboard/components/charts";
import { TransactionRow } from "@/features/transactions/components/transaction-row";
import { QuickAdd } from "@/features/transactions/components/quick-add";
import { EmptyState } from "@/components/shared/empty-state";
import { WelcomeIllustration } from "@/components/illustrations";
import { Button } from "@/components/ui/button";
import { formatMoneyFromDecimal } from "@/lib/financial/money";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Dashboard — Wealth OS" };

export default async function DashboardPage() {
  const [data, profile] = await Promise.all([getDashboardData(), getProfile()]);
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
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-semibold">{dict.dashboard.title}</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString(locale === "th" ? "th-TH" : "en-US", { month: "long", year: "numeric" })}
        </p>
      </div>

      <WealthOverview />

      <SummaryCards
        incomeCents={data.incomeCents}
        expensesCents={data.expensesCents}
        cashFlowCents={data.cashFlowCents}
        savingsRatePercent={data.savingsRatePercent}
        currencyCode={currencyCode}
        labels={{
          income: dict.dashboard.monthlyIncome,
          expenses: dict.dashboard.monthlyExpenses,
          cashFlow: dict.dashboard.cashFlow,
          savingsRate: dict.dashboard.savingsRate,
        }}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <IncomeVsExpenseChart
          incomeCents={data.incomeCents}
          expensesCents={data.expensesCents}
          currencyCode={currencyCode}
        />
        <SpendingByCategoryChart data={data.spendingByCategory} currencyCode={currencyCode} />
      </div>

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
