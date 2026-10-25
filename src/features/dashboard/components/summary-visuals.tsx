"use client";

import type { ReactNode } from "react";
import { Wallet } from "lucide-react";

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

const SHORT_TEXT = "text-[#B23A48] dark:text-rose-300";
const GOOD_TEXT = "text-[#2F7A5A] dark:text-emerald-300";

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
  month: {
    incomeCents: number;
    expensesCents: number;
    cashFlowCents: number;
    savingsRatePercent: number;
    hasData: boolean;
    /** Already-formatted, e.g. "ตุลาคม". */
    name: string;
    /** Days after today until the month ends; 0 on its last day. */
    daysLeft: number;
    /** Last month's short name, e.g. "ก.ย.". */
    previousName: string;
    /** Last month over the same days; null when it had no transactions. */
    previous: { incomeCents: number; expensesCents: number; savingsRatePercent: number } | null;
  };
  currencyCode: string;
  accounts: Account[];
  categories: Category[];
  /** This year's left-over per month, shown first under the bar. */
  yearChart?: ReactNode;
  /** This month's spending by category, shown last. */
  children?: ReactNode;
  labels: {
    title: string;
    surplus: string;
    deficit: string;
    even: string;
    barAria: string;
    noDataTitle: string;
    noDataHint: string;
    income: string;
    expenses: string;
    remaining: string;
    savingsRate: string;
    monthNoData: string;
    /** "{days}" placeholder. */
    daysLeft: string;
    lastDay: string;
    /** "{month}" and "{amount}" placeholders. */
    previousValue: string;
    lessThan: string;
    moreThan: string;
    /** "{month}" placeholder. */
    sameAs: string;
    leftOver: string;
    overspent: string;
  };
}

/**
 * Home's year-to-date money summary (design H1, 2026-10-24): a compact card
 * under the Net Worth hero. Kept deliberately quiet (one modest figure, a
 * slim bar) so Net Worth stays the page's only headline. A green income
 * bar pushes from the left against a red expense bar from the right; the
 * coin marks where they meet. Yearly on purpose (see /help#yearly-view).
 * The monthly bars, this month's numbers and the category list are always
 * shown (2026-10-25: the "Why yearly?" link and "View details" toggle were
 * removed at the user's request).
 */
export function YearlyBalanceCard({
  yearIncomeCents,
  yearExpensesCents,
  hasYearData,
  rangeLabel,
  month,
  currencyCode,
  accounts,
  categories,
  yearChart,
  children,
  labels,
}: YearlyBalanceCardProps) {
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

        <div className="space-y-3 border-t pt-3 pb-4 text-xs">
          {yearChart ? <div className="border-b pb-3">{yearChart}</div> : null}
          <MonthTiles month={month} currencyCode={currencyCode} labels={labels} />
          {children ? <div className="border-t pt-3">{children}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * This month as a 2×2 grid (mockup v5 "A", 2026-10-25). Each tile's second
 * line compares with the same days of last month in baht, not a percentage
 * of the whole of last month, which read as "−88%" a week before month end.
 */
function MonthTiles({
  month,
  currencyCode,
  labels,
}: {
  month: YearlyBalanceCardProps["month"];
  currencyCode: string;
  labels: YearlyBalanceCardProps["labels"];
}) {
  const whole = (cents: number) => formatWhole(cents, currencyCode);
  const prev = month.previous;
  const withMonth = (template: string, amount?: string) =>
    template.replace("{month}", month.previousName).replace("{amount}", amount ?? "");

  let expensesNote: { text: string; tone?: string } | null = null;
  if (prev) {
    const diff = month.expensesCents - prev.expensesCents;
    // Under one baht reads as "the same" once figures are rounded to whole baht.
    expensesNote =
      Math.abs(diff) < 100
        ? { text: withMonth(labels.sameAs) }
        : diff < 0
          ? { text: withMonth(labels.lessThan, whole(-diff)), tone: GOOD_TEXT }
          : { text: withMonth(labels.moreThan, whole(diff)), tone: SHORT_TEXT };
  }

  const isShort = month.cashFlowCents < 0;
  const tiles: { key: string; label: string; value: string; valueTone?: string; note: { text: string; tone?: string } | null }[] = [
    {
      key: "income",
      label: labels.income,
      value: whole(month.incomeCents),
      note: prev ? { text: withMonth(labels.previousValue, whole(prev.incomeCents)) } : null,
    },
    { key: "expenses", label: labels.expenses, value: whole(month.expensesCents), note: expensesNote },
    {
      key: "remaining",
      label: labels.remaining,
      value: whole(month.cashFlowCents),
      valueTone: isShort ? SHORT_TEXT : undefined,
      note: month.cashFlowCents === 0 ? null : { text: isShort ? labels.overspent : labels.leftOver },
    },
    {
      key: "savings",
      label: labels.savingsRate,
      value: `${month.savingsRatePercent.toFixed(1)}%`,
      valueTone: month.savingsRatePercent < 0 ? SHORT_TEXT : undefined,
      note: prev ? { text: withMonth(labels.previousValue, `${prev.savingsRatePercent.toFixed(1)}%`) } : null,
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{month.name}</p>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground tabular-nums">
          {month.daysLeft > 0 ? labels.daysLeft.replace("{days}", String(month.daysLeft)) : labels.lastDay}
        </span>
      </div>
      {month.hasData ? (
        <dl className="grid grid-cols-2 gap-2">
          {tiles.map((tile) => (
            <div key={tile.key} className="min-w-0 rounded-xl border px-3 py-2">
              <dt className="text-[11px] text-muted-foreground">{tile.label}</dt>
              <dd className={cn("text-base font-semibold tabular-nums", tile.valueTone)}>{tile.value}</dd>
              {tile.note ? (
                <dd className={cn("truncate text-[11px] text-muted-foreground tabular-nums", tile.note.tone)}>{tile.note.text}</dd>
              ) : null}
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-muted-foreground">{labels.monthNoData}</p>
      )}
    </div>
  );
}
