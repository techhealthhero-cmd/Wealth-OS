"use client";

import type { ReactNode } from "react";
import { TrendingDown, TrendingUp, Wallet } from "lucide-react";

import type { Account, Category } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconChip } from "@/components/shared/icon-chip";
import { QuickAdd } from "@/features/transactions/components/quick-add";
import { formatMoney } from "@/lib/financial/money";
import { cn } from "@/lib/utils";

interface GoalProgressRingProps {
  progress: number;
  label: string;
}

/** A CSS conic-gradient avoids loading the charting runtime for one ring. */
export function GoalProgressRing({ progress, label }: GoalProgressRingProps) {
  const safeProgress = Math.min(100, Math.max(0, progress));
  return (
    <div
      className="relative size-20 shrink-0 rounded-full sm:size-24"
      role="img"
      aria-label={`${label}: ${safeProgress.toFixed(0)}%`}
      style={{
        background: `conic-gradient(var(--primary) ${safeProgress * 3.6}deg, var(--muted) 0deg)`,
      }}
    >
      <span className="absolute inset-[22%] rounded-full bg-card" aria-hidden="true" />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-base font-bold tabular-nums sm:text-lg">
        {safeProgress.toFixed(0)}%
      </span>
    </div>
  );
}

function InlineTrend({
  changeValue,
  unit = "%",
  invertTone = false,
}: {
  changeValue: number | null;
  unit?: "%" | "pp";
  invertTone?: boolean;
}) {
  if (changeValue === null) return null;
  const isGoodDirection = invertTone ? changeValue <= 0 : changeValue >= 0;
  const Icon = changeValue >= 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium",
        isGoodDirection ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      )}
    >
      <Icon className="size-2.5" aria-hidden="true" />
      {changeValue >= 0 ? "+" : ""}
      {changeValue.toFixed(1)}
      {unit}
    </span>
  );
}

interface ThisMonthCardProps {
  incomeCents: number;
  expensesCents: number;
  cashFlowCents: number;
  savingsRatePercent: number;
  incomeChangePercent: number | null;
  expensesChangePercent: number | null;
  cashFlowChangePercent: number | null;
  savingsRateChangePoints: number | null;
  hasData: boolean;
  currencyCode: string;
  accounts: Account[];
  categories: Category[];
  /** The spending-by-category chart. */
  children?: ReactNode;
  labels: {
    title: string;
    income: string;
    expenses: string;
    remaining: string;
    savingsRate: string;
    vsLastMonth: string;
    noDataTitle: string;
    noDataHint: string;
  };
}

/**
 * This month's income, expenses, remaining and savings rate (each vs last
 * month) plus spending by category. Home's headline summary is year to date
 * (YearlyBalanceStrip in the Net Worth hero), so the monthly view sits under
 * "More insights" for anyone checking which month was unusual.
 */
export function ThisMonthCard({
  incomeCents,
  expensesCents,
  cashFlowCents,
  savingsRatePercent,
  incomeChangePercent,
  expensesChangePercent,
  cashFlowChangePercent,
  savingsRateChangePoints,
  hasData,
  currencyCode,
  accounts,
  categories,
  children,
  labels,
}: ThisMonthCardProps) {
  if (!hasData) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <IconChip icon={Wallet} tone="lavender" className="size-10" />
          <div className="space-y-1">
            <p className="font-medium">{labels.noDataTitle}</p>
            <p className="text-sm text-muted-foreground">{labels.noDataHint}</p>
          </div>
          <QuickAdd accounts={accounts} categories={categories} variant="inline" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{labels.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="space-y-2">
          <DetailRow label={labels.income} value={formatMoney(incomeCents, currencyCode)}>
            <InlineTrend changeValue={incomeChangePercent} />
          </DetailRow>
          <DetailRow label={labels.expenses} value={formatMoney(expensesCents, currencyCode)}>
            <InlineTrend changeValue={expensesChangePercent} invertTone />
          </DetailRow>
          <DetailRow
            label={labels.remaining}
            value={formatMoney(cashFlowCents, currencyCode)}
            valueClassName={cashFlowCents < 0 ? "text-[#B23A48] dark:text-rose-300" : undefined}
          >
            <InlineTrend changeValue={cashFlowChangePercent} />
          </DetailRow>
          <DetailRow label={labels.savingsRate} value={`${savingsRatePercent.toFixed(1)}%`}>
            <InlineTrend changeValue={savingsRateChangePoints} unit="pp" />
          </DetailRow>
          <p className="pt-0.5 text-[11px] text-muted-foreground">{labels.vsLastMonth}</p>
        </div>
        {children ? <div className="border-t pt-3">{children}</div> : null}
      </CardContent>
    </Card>
  );
}

function DetailRow({
  label,
  value,
  valueClassName,
  children,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("flex items-center gap-1.5 font-medium tabular-nums", valueClassName)}>
        {value}
        {children}
      </span>
    </div>
  );
}
