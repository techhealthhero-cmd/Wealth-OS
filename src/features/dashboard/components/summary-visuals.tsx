"use client";

import { useState } from "react";
import { ChevronDown, TrendingDown, TrendingUp, Wallet } from "lucide-react";

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

interface MonthlyDonutCardProps {
  incomeCents: number;
  expensesCents: number;
  cashFlowCents: number;
  savingsRatePercent: number;
  incomeChangePercent: number | null;
  expensesChangePercent: number | null;
  cashFlowChangePercent: number | null;
  savingsRateChangePoints: number | null;
  hasDataThisMonth: boolean;
  currencyCode: string;
  accounts: Account[];
  categories: Category[];
  labels: {
    title: string;
    income: string;
    expenses: string;
    remaining: string;
    cashFlow: string;
    savingsRate: string;
    vsLastMonth: string;
    viewDetails: string;
    noDataTitle: string;
    noDataHint: string;
  };
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

/** The common monthly summary only needs two arcs, not the Recharts runtime. */
export function MonthlyDonutCard({
  incomeCents,
  expensesCents,
  cashFlowCents,
  savingsRatePercent,
  incomeChangePercent,
  expensesChangePercent,
  cashFlowChangePercent,
  savingsRateChangePoints,
  hasDataThisMonth,
  currencyCode,
  accounts,
  categories,
  labels,
}: MonthlyDonutCardProps) {
  const [expanded, setExpanded] = useState(false);
  const total = Math.max(0, incomeCents) + Math.max(0, expensesCents);
  const incomeDegrees = total > 0 ? (Math.max(0, incomeCents) / total) * 360 : 0;

  if (!hasDataThisMonth) {
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
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 sm:gap-4">
          <div
            className="relative size-28 shrink-0 rounded-full sm:size-32"
            role="img"
            aria-label={`${labels.income}: ${formatMoney(incomeCents, currencyCode)}; ${labels.expenses}: ${formatMoney(expensesCents, currencyCode)}`}
            style={{
              background: `conic-gradient(#7FD6B2 0deg ${incomeDegrees}deg, #E5989B ${incomeDegrees}deg 360deg)`,
            }}
          >
            <span className="absolute inset-[20%] rounded-full bg-card" aria-hidden="true" />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
              <p className="text-[11px] text-muted-foreground">{labels.remaining}</p>
              <p
                className={`max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold leading-tight tabular-nums sm:text-lg ${cashFlowCents < 0 ? "text-destructive" : ""}`}
              >
                {formatMoney(cashFlowCents, currencyCode, undefined, 0)}
              </p>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <IconChip icon={TrendingUp} tone="mint" className="size-8" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-muted-foreground">{labels.income}</p>
                <div className="flex flex-wrap items-baseline gap-x-1.5">
                  <p className="break-all text-sm font-semibold tabular-nums sm:text-base">{formatMoney(incomeCents, currencyCode)}</p>
                  <InlineTrend changeValue={incomeChangePercent} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <IconChip icon={TrendingDown} tone="rose" className="size-8" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-muted-foreground">{labels.expenses}</p>
                <div className="flex flex-wrap items-baseline gap-x-1.5">
                  <p className="break-all text-sm font-semibold tabular-nums sm:text-base">{formatMoney(expensesCents, currencyCode)}</p>
                  <InlineTrend changeValue={expensesChangePercent} invertTone />
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex items-center gap-1 text-xs font-medium text-primary transition-transform duration-(--motion-fast) active:scale-[0.98]"
        >
          {labels.viewDetails}
          <ChevronDown
            className={cn("h-3 w-3 transition-transform duration-(--motion-normal) ease-(--ease-standard)", expanded && "rotate-180")}
            aria-hidden="true"
          />
        </button>

        {expanded ? (
          <div className="animate-in fade-in slide-in-from-top-1 space-y-2 border-t pt-2 text-xs duration-(--motion-normal)">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{labels.cashFlow}</span>
              <span className="flex items-center gap-1.5 font-medium">
                {formatMoney(cashFlowCents, currencyCode)}
                <InlineTrend changeValue={cashFlowChangePercent} />
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{labels.savingsRate}</span>
              <span className="flex items-center gap-1.5 font-medium">
                {savingsRatePercent.toFixed(1)}%
                <InlineTrend changeValue={savingsRateChangePoints} unit="pp" />
              </span>
            </div>
            <p className="pt-0.5 text-[11px] text-muted-foreground">{labels.vsLastMonth}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
