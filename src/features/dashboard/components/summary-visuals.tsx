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
    /** Already-localized month heading, e.g. "เดือนตุลาคม" / "October". */
    title: string;
    /** Contains {days}. */
    daysLeft: string;
    remaining: string;
    spentOverIncome: string;
    incomeShort: string;
    expensesShort: string;
    /** Contains {amount}. */
    incomeMark: string;
    /** Contains {amount}. */
    overIncome: string;
    /** Contains {expenses} and {income}. */
    spendingBarLabel: string;
    /** Contains {expenses}, {income} and {over}. */
    spendingBarOverLabel: string;
    /** Contains {percent}. */
    changeFromLastMonth: string;
    cashFlow: string;
    savingsRate: string;
    vsLastMonth: string;
    viewDetails: string;
    noDataTitle: string;
    noDataHint: string;
  };
}

const OVER_HATCH = "repeating-linear-gradient(135deg, rgb(178 58 72 / 0.85) 0 5px, rgb(178 58 72 / 0.4) 5px 10px)";

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

function MonthTile({
  label,
  amount,
  changeValue,
  changeTemplate,
  invertTone = false,
  className,
  amountClassName,
}: {
  label: string;
  amount: string;
  changeValue: number | null;
  changeTemplate: string;
  invertTone?: boolean;
  className: string;
  amountClassName: string;
}) {
  const isGoodDirection =
    changeValue === null ? true : invertTone ? changeValue <= 0 : changeValue >= 0;
  return (
    <div className={cn("min-w-0 space-y-1 rounded-2xl p-3", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("break-all text-base font-bold leading-tight tabular-nums sm:text-lg", amountClassName)}>
        {amount}
      </p>
      {changeValue !== null ? (
        <p
          className={cn(
            "text-[11px] font-medium",
            isGoodDirection ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
          )}
        >
          <span aria-hidden="true">{changeValue >= 0 ? "↑ " : "↓ "}</span>
          <span className="sr-only">{changeValue >= 0 ? "+" : "−"}</span>
          {changeTemplate.replace("{percent}", Math.abs(changeValue).toFixed(1))}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Monthly summary: one headline (what's left, or how far spending went past
 * income), ONE spending-vs-income bar, and income/expense tiles. When
 * spending exceeds income the part beyond the income mark is striped red,
 * so "how far over" reads from length. Plain CSS — no charting runtime.
 * (Name kept from the earlier donut design.)
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
  const coveredPct = scale > 0 ? (Math.min(expenses, income) / scale) * 100 : 0;
  const expensesPct = scale > 0 ? (expenses / scale) * 100 : 0;
  const isOver = expenses > income;
  const overCents = expenses - income;
  const daysLeft = Math.max(0, daysInMonth - dayOfMonth);

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

  const incomeText = formatMoney(incomeCents, currencyCode);
  const expensesText = formatMoney(expensesCents, currencyCode);
  const spentPercentText = income > 0 ? `${((expenses / income) * 100).toFixed(0)}%` : null;
  const barText = isOver
    ? labels.spendingBarOverLabel
        .replace("{expenses}", expensesText)
        .replace("{income}", incomeText)
        .replace("{over}", formatMoney(overCents, currencyCode))
    : labels.spendingBarLabel.replace("{expenses}", expensesText).replace("{income}", incomeText);
  // The visible percent caption is aria-hidden, so carry it in the label.
  const barLabel = spentPercentText ? `${barText} (${spentPercentText})` : barText;
  const incomeMarkText = labels.incomeMark.replace("{amount}", incomeText);
  // Keep the centered income caption clear of the "0" / percent captions.
  const incomeMarkLeft = Math.min(65, Math.max(30, incomePct));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle className="text-lg font-bold">{labels.title}</CardTitle>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {labels.daysLeft.replace("{days}", String(daysLeft))}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-muted-foreground">{isOver ? labels.spentOverIncome : labels.remaining}</p>
          {/* Deep rose rather than the alarm-red destructive token: a coach
              pointing something out, not a warning siren. */}
          <p
            className={cn(
              "break-all text-3xl font-bold leading-tight tabular-nums",
              (isOver || cashFlowCents < 0) && "text-[#B23A48] dark:text-rose-300"
            )}
          >
            {formatMoney(isOver ? overCents : cashFlowCents, currencyCode)}
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="relative h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={barLabel}>
            <span className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${coveredPct}%` }} />
            {isOver ? (
              <span
                className="absolute inset-y-0"
                style={{ left: `${incomePct}%`, width: `${expensesPct - incomePct}%`, background: OVER_HATCH }}
              />
            ) : null}
          </div>
          <div aria-hidden="true" className="relative flex h-4 items-center justify-between gap-2 text-[11px] text-muted-foreground tabular-nums">
            <span>0</span>
            {isOver && income > 0 ? (
              <span
                className="absolute top-0 -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${incomeMarkLeft}%` }}
              >
                {incomeMarkText}
              </span>
            ) : null}
            <span className="flex min-w-0 items-center gap-2">
              {!isOver && income > 0 ? <span className="truncate">{incomeMarkText}</span> : null}
              {spentPercentText ? <span>{spentPercentText}</span> : null}
            </span>
          </div>
          {/* With no income there's no ratio, so name the overspend. */}
          {income === 0 && isOver ? (
            <p className="text-xs text-muted-foreground">
              {labels.overIncome.replace("{amount}", formatMoney(overCents, currencyCode))}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MonthTile
            label={labels.incomeShort}
            amount={incomeText}
            changeValue={incomeChangePercent}
            changeTemplate={labels.changeFromLastMonth}
            className="bg-emerald-50 dark:bg-emerald-950/40"
            amountClassName="text-emerald-900 dark:text-emerald-200"
          />
          <MonthTile
            label={labels.expensesShort}
            amount={expensesText}
            changeValue={expensesChangePercent}
            changeTemplate={labels.changeFromLastMonth}
            invertTone
            className="bg-rose-50 dark:bg-rose-950/40"
            amountClassName="text-[#B23A48] dark:text-rose-300"
          />
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
