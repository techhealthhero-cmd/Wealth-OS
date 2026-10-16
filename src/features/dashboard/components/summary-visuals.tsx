"use client";

import { useState, type ReactNode } from "react";
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
  dayOfMonth: number;
  daysInMonth: number;
  currencyCode: string;
  accounts: Account[];
  categories: Category[];
  children?: ReactNode;
  labels: {
    title: string;
    income: string;
    expenses: string;
    remaining: string;
    incomeShort: string;
    expensesShort: string;
    overIncome: string;
    spentOfIncome: string;
    dayProgress: string;
    overIncomeLegend: string;
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

function BarRow({
  label,
  ariaLabel,
  amount,
  trend,
  fillPct,
  fillColor,
  overFromPct = null,
}: {
  label: string;
  ariaLabel: string;
  amount: string;
  trend: ReactNode;
  fillPct: number;
  fillColor: string;
  /** Where income ends on the shared scale; the fill beyond it is striped. */
  overFromPct?: number | null;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {trend}
      </div>
      <div className="relative h-7 overflow-hidden rounded-lg bg-muted" role="img" aria-label={ariaLabel}>
        <span className="absolute inset-y-0 left-0 rounded-lg" style={{ width: `${fillPct}%`, background: fillColor }} />
        {overFromPct !== null ? (
          <>
            <span
              className="absolute inset-y-0 rounded-r-lg"
              style={{
                left: `${overFromPct}%`,
                width: `${fillPct - overFromPct}%`,
                background:
                  "repeating-linear-gradient(135deg, color-mix(in oklab, var(--destructive) 55%, transparent) 0 5px, color-mix(in oklab, var(--destructive) 25%, transparent) 5px 10px)",
              }}
            />
            <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${overFromPct}%` }} />
          </>
        ) : null}
        {/* Over a wide pastel fill the label needs dark ink in both themes;
            over a near-empty track it sits on the muted ground instead. */}
        <span
          className={cn(
            "absolute inset-y-0 left-2.5 flex items-center text-xs font-semibold tabular-nums",
            fillPct >= 40 ? "text-[#22332b]" : "text-foreground"
          )}
        >
          {amount}
        </span>
      </div>
    </div>
  );
}

/**
 * Monthly summary as two to-scale bars (income vs expenses) on one shared
 * scale. When spending exceeds income, the part of the expense bar beyond
 * the income mark is striped red, so "how far over" reads from length.
 * Plain CSS — no charting runtime. (Name kept from the earlier donut design.)
 */
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
  dayOfMonth,
  daysInMonth,
  currencyCode,
  accounts,
  categories,
  children,
  labels,
}: MonthlyDonutCardProps) {
  const [expanded, setExpanded] = useState(false);
  const income = Math.max(0, incomeCents);
  const expenses = Math.max(0, expensesCents);
  const scale = Math.max(income, expenses);
  const incomePct = scale > 0 ? (income / scale) * 100 : 0;
  const expensesPct = scale > 0 ? (expenses / scale) * 100 : 0;
  const isOver = expenses > income;
  const overCents = expenses - income;

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
      <CardHeader className="flex flex-row items-baseline justify-between gap-3">
        <CardTitle className="text-base">{labels.title}</CardTitle>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {labels.dayProgress.replace("{day}", String(dayOfMonth)).replace("{total}", String(daysInMonth))}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-muted-foreground">{labels.remaining}</p>
          <p
            className={cn(
              "break-all text-3xl font-bold leading-tight tabular-nums",
              cashFlowCents < 0 && "text-destructive"
            )}
          >
            {formatMoney(cashFlowCents, currencyCode)}
          </p>
          {isOver ? (
            <p className="text-xs text-muted-foreground">
              {labels.overIncome.replace("{amount}", formatMoney(overCents, currencyCode))}
            </p>
          ) : income > 0 ? (
            <p className="text-xs text-muted-foreground">
              {labels.spentOfIncome.replace("{percent}", ((expenses / income) * 100).toFixed(0))}
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <BarRow
            label={labels.incomeShort}
            ariaLabel={`${labels.income}: ${formatMoney(incomeCents, currencyCode)}`}
            amount={formatMoney(incomeCents, currencyCode)}
            trend={<InlineTrend changeValue={incomeChangePercent} />}
            fillPct={incomePct}
            fillColor="#7FD6B2"
          />
          <BarRow
            label={labels.expensesShort}
            ariaLabel={`${labels.expenses}: ${formatMoney(expensesCents, currencyCode)}`}
            amount={formatMoney(expensesCents, currencyCode)}
            trend={<InlineTrend changeValue={expensesChangePercent} invertTone />}
            fillPct={expensesPct}
            fillColor="#E5989B"
            overFromPct={isOver ? incomePct : null}
          />
          {isOver ? <p className="text-[11px] text-muted-foreground">{labels.overIncomeLegend}</p> : null}
        </div>

        <div className="flex gap-[3px]" aria-hidden="true">
          {Array.from({ length: daysInMonth }, (_, i) => (
            <span
              key={i}
              className={cn("h-1 flex-1 rounded-full", i < dayOfMonth ? "bg-amber-600/70 dark:bg-amber-400/70" : "bg-muted")}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="flex items-center gap-1 text-xs font-medium text-primary transition-transform duration-(--motion-fast) active:scale-[0.98]"
        >
          {labels.viewDetails}
          <ChevronDown
            className={cn("h-3 w-3 transition-transform duration-(--motion-normal) ease-(--ease-standard)", expanded && "rotate-180")}
            aria-hidden="true"
          />
        </button>

        {expanded ? (
          <div className="animate-in fade-in slide-in-from-top-1 space-y-3 border-t pt-2 text-xs duration-(--motion-normal)">
            <div className="space-y-2">
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
            {children ? <div className="border-t pt-3">{children}</div> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
