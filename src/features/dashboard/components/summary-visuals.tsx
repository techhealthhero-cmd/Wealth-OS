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
  /** Year-to-date savings rate, from calculateSavingsRate(). */
  yearSavingsRatePercent: number;
  hasYearData: boolean;
  /** Already-formatted, e.g. "ม.ค. – ต.ค." */
  rangeLabel: string;
  currencyCode: string;
  accounts: Account[];
  categories: Category[];
  /** This year's left-over per month, shown under the year tiles. */
  yearChart?: ReactNode;
  /** This year's spending by category, shown last. */
  children?: ReactNode;
  /** Replaces the plain heading — Home's year picker (2026-10-26). */
  titleSlot?: ReactNode;
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
 * 2026-10-26: everything in the card is year to date — the "this month"
 * tiles became year tiles and the category list covers the whole year,
 * at the user's request.
 */
export function YearlyBalanceCard({
  yearIncomeCents,
  yearExpensesCents,
  yearSavingsRatePercent,
  hasYearData,
  rangeLabel,
  currencyCode,
  accounts,
  categories,
  yearChart,
  children,
  titleSlot,
  labels,
}: YearlyBalanceCardProps) {
  if (!hasYearData) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          {/* Still switchable to another year when the picked one is empty. */}
          {titleSlot ? <div className="self-start text-left">{titleSlot}</div> : null}
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

  const tiles: { key: string; label: string; value: string; valueTone?: string; note?: string }[] = [
    { key: "income", label: labels.income, value: incomeText },
    { key: "expenses", label: labels.expenses, value: expensesText },
    {
      key: "remaining",
      label: labels.remaining,
      value: formatWhole(balance.netCents, currencyCode),
      valueTone: isShort ? SHORT_TEXT : GOOD_TEXT,
      note: balance.netCents === 0 ? undefined : isShort ? labels.overspent : labels.leftOver,
    },
    {
      key: "savings",
      label: labels.savingsRate,
      value: `${yearSavingsRatePercent.toFixed(1)}%`,
      valueTone: yearSavingsRatePercent < 0 ? SHORT_TEXT : undefined,
    },
  ];

  return (
    <Card>
      <CardContent className="space-y-2.5 pb-0">
        <div className="flex items-baseline justify-between gap-3">
          {titleSlot ?? (
            <h2 className="truncate text-sm font-semibold text-muted-foreground">
              {labels.title.replace("{range}", rangeLabel)}
            </h2>
          )}
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

        <dl className="grid grid-cols-2 gap-2 pt-1">
          {tiles.map((tile) => (
            <div key={tile.key} className="min-w-0 rounded-xl border px-3 py-2">
              <dt className="text-[11px] text-muted-foreground">{tile.label}</dt>
              <dd className={cn("text-base font-semibold tabular-nums", tile.valueTone)}>{tile.value}</dd>
              {tile.note ? <dd className="truncate text-[11px] text-muted-foreground">{tile.note}</dd> : null}
            </div>
          ))}
        </dl>

        <div className="space-y-3 border-t pt-3 pb-4 text-xs">
          {yearChart ? <div className="border-b pb-3">{yearChart}</div> : null}
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
