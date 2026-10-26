"use client";

import { ChevronRight, Lightbulb } from "lucide-react";

import { slipCopy } from "@/features/capture/components/slip-auto/copy";
import { formatBaht } from "@/features/capture/components/slip-auto/format";
import { categoryColor, type MonthlySpendSummary } from "@/features/capture/components/slip-auto/types";

export interface MonthlySpendCardProps {
  /** Real data only. null/undefined => the card renders nothing (never fake numbers). */
  summary: MonthlySpendSummary | null | undefined;
  /** Opens MonthlySpendDetail. Without it the card is a static, non-interactive summary. */
  onOpen?: () => void;
}

export function MonthlySpendCardBody({ summary, interactive }: { summary: MonthlySpendSummary; interactive: boolean }) {
  const c = slipCopy.month;
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-semibold">{summary.monthShortLabel}</span>
        {interactive ? <ChevronRight className="size-5 shrink-0 text-[#9a9484]" aria-hidden="true" /> : null}
      </div>
      <p className="mt-1 text-[13px] text-muted-foreground">{c.spent}</p>
      <p className="text-[clamp(2rem,10vw,2.375rem)] leading-[1.2] font-bold tracking-tight whitespace-nowrap text-[#a4574a] tabular-nums">
        {formatBaht(summary.spentCents)}
      </p>
      <p className="mt-1 text-sm font-semibold text-[#2f8a5b] tabular-nums">
        <span className="whitespace-nowrap">
          {c.income} {formatBaht(summary.incomeCents)}
        </span>{" "}
        ·{" "}
        <span className="whitespace-nowrap">
          {c.left} {formatBaht(summary.leftCents)}
        </span>
      </p>
      {summary.categories.length > 0 ? (
        <>
          <div className="mt-3 flex h-5 gap-0.5 overflow-hidden rounded-[10px]" aria-hidden="true">
            {summary.categories.map((cat, i) => (
              <i key={cat.id} className="block h-full" style={{ width: `${cat.percent}%`, background: categoryColor(cat, i) }} />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
            {summary.categories.map((cat, i) => (
              <li key={cat.id} className="inline-flex min-w-0 items-center">
                <i className="mr-1 inline-block size-[9px] shrink-0 rounded-[3px]" style={{ background: categoryColor(cat, i) }} />
                <span className="truncate">{cat.label}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {summary.insight ? (
        <p className="mt-3 flex gap-2 rounded-[14px] border border-dashed border-[#b99a65] bg-[#f3ecd8] px-3 py-2.5 text-[13px] leading-[19px] text-[#5b4a22]">
          <Lightbulb className="mt-px size-[18px] shrink-0 text-[#a8833f]" aria-hidden="true" />
          <span className="min-w-0">{summary.insight}</span>
        </p>
      ) : null}
    </>
  );
}

const CARD_CLASS =
  "block w-full rounded-[22px] border border-border bg-card p-4 text-left shadow-card";

/**
 * "<เดือน> ใช้ไปแล้ว ฿…" + income/left + one stacked category bar +
 * one insight line. The slip preview still renders this card. Home does not.
 */
export function MonthlySpendCard({ summary, onOpen }: MonthlySpendCardProps) {
  if (!summary) return null;
  if (!onOpen) {
    return (
      <section data-testid="monthly-spend-card" className={CARD_CLASS} aria-label={summary.monthShortLabel}>
        <MonthlySpendCardBody summary={summary} interactive={false} />
      </section>
    );
  }
  return (
    <button
      type="button"
      data-testid="monthly-spend-card"
      onClick={onOpen}
      aria-label={`${slipCopy.month.openDetail}: ${summary.monthShortLabel}`}
      className={`${CARD_CLASS} card-interactive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
    >
      <MonthlySpendCardBody summary={summary} interactive />
    </button>
  );
}
