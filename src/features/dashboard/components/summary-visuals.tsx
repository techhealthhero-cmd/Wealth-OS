"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, TrendingDown, TrendingUp, Wallet } from "lucide-react";

import type { Account, Category } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { IconChip } from "@/components/shared/icon-chip";
import { QuickAdd } from "@/features/transactions/components/quick-add";
import { formatMoney } from "@/lib/financial/money";
import { calculateYearlyBalance } from "@/lib/financial/yearly-balance";
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

/** Rounded to whole baht: a supporting figure shouldn't read as long as the headline. */
function formatWhole(cents: number, currencyCode: string) {
  return formatMoney(cents, currencyCode, undefined, 0);
}

interface YearlyBalanceCardProps {
  yearIncomeCents: number;
  yearExpensesCents: number;
  hasYearData: boolean;
  /** Already-formatted, e.g. "ม.ค. – ต.ค." */
  rangeLabel: string;
  helpHref: string;
  month: {
    incomeCents: number;
    expensesCents: number;
    cashFlowCents: number;
    savingsRatePercent: number;
    incomeChangePercent: number | null;
    expensesChangePercent: number | null;
    cashFlowChangePercent: number | null;
    savingsRateChangePoints: number | null;
    hasData: boolean;
  };
  currencyCode: string;
  accounts: Account[];
  categories: Category[];
  /** The spending-by-category chart, shown under "View details". */
  children?: ReactNode;
  labels: {
    title: string;
    surplus: string;
    deficit: string;
    even: string;
    barAria: string;
    whyYearly: string;
    viewDetails: string;
    noDataTitle: string;
    noDataHint: string;
    income: string;
    expenses: string;
    thisMonth: string;
    remaining: string;
    savingsRate: string;
    vsLastMonth: string;
    monthNoData: string;
  };
}

/**
 * Home's year-to-date money summary (design H1, 2026-10-24): a compact card
 * under the Net Worth hero. Kept deliberately quiet (one modest figure, a
 * slim bar) so Net Worth stays the page's only headline. A green income
 * bar pushes from the left against a red expense bar from the right; the
 * coin marks where they meet. Yearly on purpose (see /help#yearly-view);
 * this month's numbers and the category chart are under "View details".
 */
export function YearlyBalanceCard({
  yearIncomeCents,
  yearExpensesCents,
  hasYearData,
  rangeLabel,
  helpHref,
  month,
  currencyCode,
  accounts,
  categories,
  children,
  labels,
}: YearlyBalanceCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (!hasYearData) {
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

  const balance = calculateYearlyBalance(yearIncomeCents, yearExpensesCents);
  const isShort = balance.status === "deficit";
  const incomeText = formatWhole(balance.incomeCents, currencyCode);
  const expensesText = formatWhole(balance.expensesCents, currencyCode);
  const statusLabel = balance.status === "surplus" ? labels.surplus : isShort ? labels.deficit : labels.even;
  const meet = balance.meetingPointPercent;

  return (
    <Card>
      <CardContent className="space-y-2.5 pb-0">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="truncate text-sm font-semibold text-muted-foreground">
            {labels.title.replace("{range}", rangeLabel)}
          </h2>
          <p className="shrink-0 text-xs text-muted-foreground">
            {statusLabel}{" "}
            <span
              className={cn(
                "text-xl font-bold tabular-nums",
                isShort ? "text-[#B23A48] dark:text-rose-300" : "text-[#2F7A5A] dark:text-emerald-300"
              )}
            >
              {balance.netCents > 0 ? "+" : ""}
              {formatWhole(balance.netCents, currencyCode)}
            </span>
          </p>
        </div>

        <div
          className="relative h-6"
          role="img"
          aria-label={labels.barAria.replace("{income}", incomeText).replace("{expenses}", expensesText)}
        >
          <div className="absolute inset-x-0 top-1.5 flex h-3 overflow-hidden rounded-full bg-muted shadow-[inset_0_1px_2px_rgba(94,74,38,0.18)]">
            <span
              className="h-full bg-[linear-gradient(180deg,#B9E8D1_0%,#74C29E_100%)] transition-[width] duration-(--motion-value) ease-(--ease-standard)"
              style={{ width: `${meet}%` }}
            />
            <span className="h-full flex-1 bg-[linear-gradient(180deg,#E79AA2_0%,#C25B67_100%)]" />
          </div>
          <span
            className="absolute inset-y-0.5 left-1/2 w-0.5 -translate-x-1/2 bg-[repeating-linear-gradient(180deg,currentColor_0_3px,transparent_3px_6px)] text-foreground opacity-40"
            aria-hidden="true"
          />
          <span
            className="absolute top-3 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-card bg-[radial-gradient(circle_at_35%_30%,#F6E3AE_0%,#D9B866_55%,#B8954A_100%)] text-[11px] font-bold text-[#5A4416] shadow-[0_2px_5px_rgba(94,74,38,0.3)] transition-[left] duration-(--motion-value) ease-(--ease-standard)"
            style={{ left: `${meet}%` }}
            aria-hidden="true"
          >
            ฿
          </span>
        </div>

        <div className="flex justify-between gap-3 text-xs text-muted-foreground tabular-nums">
          <span>
            {labels.income} {incomeText}
          </span>
          <span>
            {labels.expenses} {expensesText}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 border-t">
          <Link
            href={helpHref}
            className="flex min-h-11 items-center text-xs font-semibold text-[#2F6B8A] underline-offset-4 hover:underline dark:text-sky-300"
          >
            {labels.whyYearly}
          </Link>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="flex min-h-11 items-center gap-1 text-xs font-semibold transition-transform duration-(--motion-fast) active:scale-[0.98]"
          >
            {labels.viewDetails}
            <ChevronDown
              className={cn("size-3.5 transition-transform duration-(--motion-normal) ease-(--ease-standard)", expanded && "rotate-180")}
              aria-hidden="true"
            />
          </button>
        </div>

        {expanded ? (
          <div className="animate-in fade-in slide-in-from-top-1 space-y-3 border-t pt-3 text-xs duration-(--motion-normal)">
            <p className="text-sm font-semibold">{labels.thisMonth}</p>
            {month.hasData ? (
              <div className="space-y-2">
                <DetailRow label={labels.income} value={formatMoney(month.incomeCents, currencyCode)}>
                  <InlineTrend changeValue={month.incomeChangePercent} />
                </DetailRow>
                <DetailRow label={labels.expenses} value={formatMoney(month.expensesCents, currencyCode)}>
                  <InlineTrend changeValue={month.expensesChangePercent} invertTone />
                </DetailRow>
                <DetailRow
                  label={labels.remaining}
                  value={formatMoney(month.cashFlowCents, currencyCode)}
                  valueClassName={month.cashFlowCents < 0 ? "text-[#B23A48] dark:text-rose-300" : undefined}
                >
                  <InlineTrend changeValue={month.cashFlowChangePercent} />
                </DetailRow>
                <DetailRow label={labels.savingsRate} value={`${month.savingsRatePercent.toFixed(1)}%`}>
                  <InlineTrend changeValue={month.savingsRateChangePoints} unit="pp" />
                </DetailRow>
                <p className="pt-0.5 text-[11px] text-muted-foreground">{labels.vsLastMonth}</p>
              </div>
            ) : (
              <p className="text-muted-foreground">{labels.monthNoData}</p>
            )}
            {children ? <div className="border-t pt-3">{children}</div> : null}
          </div>
        ) : null}
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
