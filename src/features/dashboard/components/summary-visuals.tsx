"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, TrendingDown, TrendingUp, Wallet } from "lucide-react";

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

/** Whole baht when there are no satang, so the headline stays short. */
function formatCompact(cents: number, currencyCode: string) {
  return formatMoney(cents, currencyCode, undefined, cents % 100 === 0 ? 0 : 2);
}

interface YearlyBalanceCardProps {
  yearIncomeCents: number;
  yearExpensesCents: number;
  hasYearData: boolean;
  /** Already-formatted, e.g. "ม.ค. – ต.ค." */
  rangeLabel: string;
  /** Calendar year as the user reads it (Buddhist era in Thai). */
  yearLabel: string;
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
  children?: ReactNode;
  labels: {
    title: string;
    surplus: string;
    deficit: string;
    even: string;
    incomeMore: string;
    expensesMore: string;
    evenLine: string;
    noRatio: string;
    scaleShort: string;
    scaleEven: string;
    scaleSurplus: string;
    barAria: string;
    whyYearly: string;
    viewDetails: string;
    noDataTitle: string;
    noDataHint: string;
    monthNoData: string;
    income: string;
    expenses: string;
    thisMonth: string;
    remaining: string;
    savingsRate: string;
    vsLastMonth: string;
  };
}

/**
 * Home's money summary, year to date: a green income bar pushing from the
 * left against a red expense bar pushing from the right, with a coin where
 * they meet. Yearly on purpose — a once-a-year bill (insurance, car tax)
 * would make its month look like an overspend. This month's numbers stay
 * one tap away under "View details". Plain CSS, no charting runtime.
 */
export function YearlyBalanceCard({
  yearIncomeCents,
  yearExpensesCents,
  hasYearData,
  rangeLabel,
  yearLabel,
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
  const percentText = balance.differencePercent === null ? null : Math.round(balance.differencePercent).toString();
  const subline =
    balance.status === "even"
      ? labels.evenLine
      : percentText === null
        ? labels.noRatio
        : (isShort ? labels.expensesMore : labels.incomeMore).replace("{percent}", percentText);
  const sign = balance.netCents > 0 ? "+" : "";
  const incomeText = formatCompact(balance.incomeCents, currencyCode);
  const expensesText = formatCompact(balance.expensesCents, currencyCode);
  const meet = balance.meetingPointPercent;

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold">{labels.title.replace("{year}", yearLabel)}</h2>
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{rangeLabel}</span>
        </div>

        <div className="space-y-1">
          <span
            className={cn(
              "inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold",
              isShort
                ? "bg-rose-100 text-[#8A2F3C] dark:bg-rose-950/60 dark:text-rose-200"
                : "bg-emerald-100 text-[#1F5C43] dark:bg-emerald-950/60 dark:text-emerald-200"
            )}
          >
            {balance.status === "surplus" ? labels.surplus : isShort ? labels.deficit : labels.even}
          </span>
          {/* Deep rose rather than the alarm-red destructive token: a coach
              pointing something out, not a warning siren. */}
          <p
            className={cn(
              "break-all text-4xl font-bold leading-tight tracking-tight tabular-nums",
              isShort ? "text-[#B23A48] dark:text-rose-300" : "text-[#2F7A5A] dark:text-emerald-300"
            )}
          >
            {sign}
            {formatCompact(balance.netCents, currencyCode)}
          </p>
          <p className="text-sm text-muted-foreground">{subline}</p>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60">
              <ArrowUp className="size-3.5 text-[#2F7A5A] dark:text-emerald-300" strokeWidth={3} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">{labels.income}</p>
              <p className="truncate text-sm font-bold tabular-nums">{incomeText}</p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 text-right">
              <p className="text-[11px] text-muted-foreground">{labels.expenses}</p>
              <p className="truncate text-sm font-bold tabular-nums">{expensesText}</p>
            </div>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/60">
              <ArrowDown className="size-3.5 text-[#A3404E] dark:text-rose-300" strokeWidth={3} aria-hidden="true" />
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <div
            className="relative h-11"
            role="img"
            aria-label={labels.barAria.replace("{income}", incomeText).replace("{expenses}", expensesText)}
          >
            {/* The tube: a recessed track with two glassy fills that meet. */}
            <div className="absolute inset-x-0 top-2 flex h-7 overflow-hidden rounded-full bg-muted shadow-[inset_0_2px_4px_rgba(94,74,38,0.18)]">
              <div
                className="relative bg-[linear-gradient(180deg,#B9E8D1_0%,#74C29E_100%)] transition-[width] duration-(--motion-value) ease-(--ease-standard)"
                style={{ width: `${meet}%` }}
              >
                <span className="absolute inset-x-2.5 top-1 h-1.5 rounded-full bg-white/55" />
              </div>
              <div className="relative flex-1 bg-[linear-gradient(180deg,#E79AA2_0%,#C25B67_100%)]">
                <span className="absolute inset-x-2.5 top-1 h-1.5 rounded-full bg-white/40" />
              </div>
            </div>
            <span
              className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-[repeating-linear-gradient(180deg,currentColor_0_4px,transparent_4px_7px)] text-foreground opacity-45"
              aria-hidden="true"
            />
            <span
              className="absolute top-[22px] flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-card bg-[radial-gradient(circle_at_35%_30%,#F6E3AE_0%,#D9B866_55%,#B8954A_100%)] text-[17px] font-bold text-[#5A4416] shadow-[0_3px_8px_rgba(94,74,38,0.35)] transition-[left] duration-(--motion-value) ease-(--ease-standard)"
              style={{ left: `${meet}%` }}
              aria-hidden="true"
            >
              ฿
            </span>
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground" aria-hidden="true">
            <span>← {labels.scaleShort}</span>
            <span>{labels.scaleEven}</span>
            <span>{labels.scaleSurplus} →</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t pt-1">
          <Link
            href={helpHref}
            className="flex min-h-11 items-center text-sm font-semibold text-[#2F6B8A] underline-offset-4 hover:underline dark:text-sky-300"
          >
            {labels.whyYearly}
          </Link>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="flex min-h-11 items-center gap-1 text-sm font-semibold transition-transform duration-(--motion-fast) active:scale-[0.98]"
          >
            {labels.viewDetails}
            {expanded ? (
              <ChevronDown className="size-4 rotate-180 transition-transform duration-(--motion-normal)" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-4" aria-hidden="true" />
            )}
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
