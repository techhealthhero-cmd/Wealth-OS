"use client";

import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { formatMoney } from "@/lib/financial/money";
import { cn } from "@/lib/utils";
import { useTransactionsQuery } from "./use-transactions-query";

/** Same leather green as the Home net-worth card, dark in both themes. */
const HERO_BACKGROUND =
  "radial-gradient(110% 100% at 100% 0%, #2d6650 0%, rgba(45,102,80,0) 60%), linear-gradient(180deg, #24533f 0%, #1b4335 60%, #173b30 100%)";

export interface MonthHeroLabels {
  goal: string;
  month: string;
  income: string;
  expense: string;
  net: string;
  budgetUsed: string;
  budgetUsedShort: string;
  budgetFoot: string;
  budgetLeft: string;
  budgetOver: string;
  previous: string;
  next: string;
}

export interface MonthHeroBudget {
  percentUsed: number;
  remainingCents: number;
}

export interface MonthHeroViewProps {
  title: string;
  incomeCents: number;
  expenseCents: number;
  budget: MonthHeroBudget | null;
  currencyCode: string;
  labels: MonthHeroLabels;
  nextDisabled: boolean;
  pending?: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

function money(cents: number, currencyCode: string): string {
  const abs = Math.abs(cents);
  const digits = abs % 100 === 0 ? 0 : 2;
  return formatMoney(abs, currencyCode, currencyCode === "THB" ? "th-TH" : undefined, digits);
}

function signed(cents: number, currencyCode: string): string {
  const body = money(cents, currencyCode);
  if (cents > 0) return `+${body}`;
  if (cents < 0) return `-${body}`;
  return body;
}

function fill(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}

/**
 * The month at a glance (Finance Variant B). One leather-green card: this
 * month's income, spending and net, plus the budget when one exists.
 * Figures are passed in from the deterministic financial functions.
 */
export function MonthHeroView({
  title,
  incomeCents,
  expenseCents,
  budget,
  currencyCode,
  labels,
  nextDisabled,
  pending,
  onPrevious,
  onNext,
}: MonthHeroViewProps) {
  const netCents = incomeCents - expenseCents;
  const used = budget ? Math.max(0, Math.round(budget.percentUsed)) : 0;
  const over = budget ? budget.remainingCents < 0 || used > 100 : false;
  const bar = Math.min(used, 100);

  return (
    <section
      aria-labelledby="finance-month-heading"
      data-testid="finance-month-hero"
      data-budget={budget ? "yes" : "no"}
      className={cn("relative rounded-[22px] px-4 py-3.5 text-[#fffbf2] shadow-[0_1px_0_rgba(255,255,255,0.07)_inset,0_16px_28px_-20px_rgba(23,59,48,0.75)] transition-opacity", pending && "opacity-60")}
      style={{ background: HERO_BACKGROUND }}
      aria-busy={pending || undefined}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[5px] rounded-[16px] border-[1.5px] border-dashed border-[#fffbf2]/15"
      />
      <div className="relative flex items-start justify-between gap-3">
        <p className="pt-1.5 text-[13px] leading-5 font-medium text-[#fffbf2]/70">{budget ? labels.goal : labels.month}</p>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={onPrevious}
            aria-label={labels.previous}
            className="flex size-9 items-center justify-center rounded-full bg-[#fffbf2]/12 text-[#fffbf2] hover:bg-[#fffbf2]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fffbf2] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1b4335]"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            aria-label={labels.next}
            className="flex size-9 items-center justify-center rounded-full bg-[#fffbf2]/12 text-[#fffbf2] hover:bg-[#fffbf2]/20 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fffbf2] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1b4335]"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <h2 id="finance-month-heading" className="relative mt-1 text-[1.35rem] leading-tight font-semibold tracking-tight">
        {title}
      </h2>
      <p className="relative mt-1.5 flex items-baseline gap-2">
        <span
          data-testid="finance-month-net"
          className={cn(
            "text-[clamp(1.7rem,8vw,2.15rem)] leading-none font-bold tracking-tight tabular-nums",
            netCents < 0 && "text-[#f6d3b8]",
            netCents > 0 && "text-[#7fd6b2]",
          )}
        >
          {signed(netCents, currencyCode)}
        </span>
        <span className="text-sm font-medium text-[#fffbf2]/75">{labels.net}</span>
      </p>
      <dl className={cn("relative mt-3 grid gap-2 text-center", budget ? "grid-cols-3" : "grid-cols-2")}>
        <div className="min-w-0">
          <dt className="text-[11px] leading-4 text-[#fffbf2]/65">{labels.income}</dt>
          <dd className="truncate text-[15px] leading-5 font-semibold text-[#7fd6b2] tabular-nums">
            {incomeCents > 0 ? `+${money(incomeCents, currencyCode)}` : money(0, currencyCode)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] leading-4 text-[#fffbf2]/65">{labels.expense}</dt>
          <dd className="truncate text-[15px] leading-5 font-semibold text-[#f6d3b8] tabular-nums">
            {expenseCents > 0 ? `-${money(expenseCents, currencyCode)}` : money(0, currencyCode)}
          </dd>
        </div>
        {budget ? (
          <div className="min-w-0">
            <dt className="text-[11px] leading-4 text-[#fffbf2]/65">{labels.budgetUsedShort}</dt>
            <dd className="truncate text-[15px] leading-5 font-semibold tabular-nums">{used}%</dd>
          </div>
        ) : null}
      </dl>
      {budget ? (
        <div className="relative mt-3">
          <div
            className="h-1.5 overflow-hidden rounded-full bg-[#fffbf2]/15"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={bar}
            aria-valuetext={fill(labels.budgetUsed, { percent: String(used) })}
          >
            <div
              className={cn("h-full rounded-full", over ? "bg-[#f0b4a8]" : "bg-[#e9cf7a]")}
              style={{ width: `${bar}%` } satisfies CSSProperties}
            />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-3 text-[12px] leading-5">
            <span className="text-[#fffbf2]/65">{labels.budgetFoot}</span>
            <span className="font-medium tabular-nums">
              {budget.remainingCents >= 0
                ? fill(labels.budgetLeft, { amount: money(budget.remainingCents, currencyCode) })
                : fill(labels.budgetOver, { amount: money(-budget.remainingCents, currencyCode) })}
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function MonthHero({
  title,
  incomeCents,
  expenseCents,
  budget,
  currencyCode,
  prevMonth,
  nextMonth,
  labels,
}: {
  title: string;
  incomeCents: number;
  expenseCents: number;
  budget: MonthHeroBudget | null;
  currencyCode: string;
  prevMonth: string;
  /** null on the current month — the future stays closed. */
  nextMonth: string | null;
  labels: MonthHeroLabels;
}) {
  const { pending, push } = useTransactionsQuery();

  function moveMonth(month: string) {
    push((params) => {
      params.delete("from");
      params.delete("to");
      params.set("month", month);
    });
  }

  return (
    <MonthHeroView
      title={title}
      incomeCents={incomeCents}
      expenseCents={expenseCents}
      budget={budget}
      currencyCode={currencyCode}
      labels={labels}
      nextDisabled={nextMonth === null}
      pending={pending}
      onPrevious={() => moveMonth(prevMonth)}
      onNext={() => {
        if (nextMonth) moveMonth(nextMonth);
      }}
    />
  );
}
