"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";

import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/features/capture/components/slip-auto/category-icon";
import { slipCopy } from "@/features/capture/components/slip-auto/copy";
import { formatBaht } from "@/features/capture/components/slip-auto/format";
import type { MonthlySpendSummary } from "@/features/capture/components/slip-auto/types";

export interface MonthlySpendDetailProps {
  /** null/undefined => renders nothing. */
  summary: MonthlySpendSummary | null | undefined;
  /** -1 = previous month, +1 = next month. Refetches the selected month. */
  onMonthChange: (delta: -1 | 1) => void;
  /** "ดูทั้งหมดในหมวดนี้" — Links to Transactions filtered by category + month. */
  onViewCategory?: (categoryId: string) => void;
  /** Category id to start expanded (e.g. preview/fixtures). */
  initialOpenId?: string | null;
}

/** Opened month view: month switch, categories with expandable items. */
export function MonthlySpendDetail({ summary, onMonthChange, onViewCategory, initialOpenId = null }: MonthlySpendDetailProps) {
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  if (!summary) return null;
  const c = slipCopy.month;
  const max = Math.max(1, ...summary.categories.map((cat) => cat.amountCents));
  return (
    <section data-testid="monthly-spend-detail" className="rounded-[22px] border border-border bg-card p-4 shadow-card">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label={c.prev}
          disabled={!summary.canGoPrev}
          onClick={() => onMonthChange(-1)}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-[#204d3d]/8 disabled:opacity-35"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <b className="min-w-0 truncate text-lg font-bold">{summary.monthLabel}</b>
        <button
          type="button"
          aria-label={c.next}
          disabled={!summary.canGoNext}
          onClick={() => onMonthChange(1)}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-[#204d3d]/8 disabled:opacity-35"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-0.5 mb-2 text-center">
        <p className="text-[12.5px] text-muted-foreground">{c.spent}</p>
        <p className="text-[clamp(2rem,9vw,2.125rem)] leading-[1.2] font-bold tracking-tight whitespace-nowrap text-[#a4574a] tabular-nums">
          {formatBaht(summary.spentCents)}
        </p>
      </div>

      <ul>
        {summary.categories.map((cat) => {
          const open = openId === cat.id;
          const hasItems = (cat.items?.length ?? 0) > 0;
          return (
            <li key={cat.id} className="border-t border-dashed border-[#46648c]/20 first:border-t-0">
              <button
                type="button"
                aria-expanded={hasItems ? open : undefined}
                disabled={!hasItems}
                onClick={() => setOpenId(open ? null : cat.id)}
                className="grid min-h-14 w-full grid-cols-[36px_minmax(0,1fr)_auto_18px] items-center gap-2.5 text-left disabled:cursor-default"
              >
                <CategoryIcon icon={cat.icon} tone={cat.icon === "other" ? "gold" : "default"} />
                <span className="min-w-0">
                  <span className="block truncate text-[14.5px] leading-[18px] font-semibold">{cat.label}</span>
                  <span className="mt-[5px] block h-[9px] overflow-hidden rounded-[5px] bg-[#e6dac2]/70">
                    <i
                      className="block h-full rounded-[5px] bg-[#c46a5a]"
                      style={{ width: `${Math.round((cat.amountCents / max) * 100)}%` }}
                    />
                  </span>
                </span>
                <span className="text-right text-[14.5px] leading-[18px] font-bold whitespace-nowrap tabular-nums">
                  {formatBaht(cat.amountCents)}
                  <small className="block text-[11.5px] font-medium text-muted-foreground">{cat.percent}%</small>
                </span>
                <ChevronRight
                  className={cn("size-[18px] text-[#9a9484] transition-transform", open && "rotate-90", !hasItems && "opacity-0")}
                  aria-hidden="true"
                />
              </button>
              {open && hasItems ? (
                <div className="mb-2 ml-[46px] rounded-[14px] bg-[#fbeeea]/55 px-3 py-0.5">
                  {cat.items!.map((it) => (
                    <div
                      key={it.id}
                      className="flex min-h-11 items-center gap-2 border-t border-dashed border-[#c46a5a]/30 text-[13.5px] first:border-t-0"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {it.title}
                        <small className="ml-1.5 text-[11.5px] text-muted-foreground">{it.dateLabel}</small>
                      </span>
                      <b className="font-bold whitespace-nowrap text-[#b23a3a] tabular-nums">{formatBaht(it.amountCents, "−")}</b>
                    </div>
                  ))}
                  {onViewCategory ? (
                    <button
                      type="button"
                      onClick={() => onViewCategory(cat.id)}
                      className="inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-[#204d3d]"
                    >
                      {c.viewAll}
                      <ChevronRight className="size-3.5" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {summary.insight ? (
        <p className="mt-3 flex gap-2 rounded-[14px] border border-dashed border-[#b99a65] bg-[#f3ecd8] px-3 py-2.5 text-[13px] leading-[19px] text-[#5b4a22]">
          <Lightbulb className="mt-px size-[18px] shrink-0 text-[#a8833f]" aria-hidden="true" />
          <span className="min-w-0">{summary.insight}</span>
        </p>
      ) : null}
      <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[11.5px] text-muted-foreground">
        <Check className="size-3.5 shrink-0" aria-hidden="true" />
        {c.foot}
      </p>
    </section>
  );
}
