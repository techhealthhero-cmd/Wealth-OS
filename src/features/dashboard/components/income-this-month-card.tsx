import Link from "next/link";
import { ChevronRight, Lightbulb } from "lucide-react";

import type { IncomeBySourceSummary, IncomeSourceGroup } from "@/features/dashboard/lib/income-by-source";
import { formatMoney } from "@/lib/financial/money";
import { cn } from "@/lib/utils";
import { SplitMoneyAmount } from "./split-money-amount";

export type { IncomeBySourceSummary, IncomeSourceGroup } from "@/features/dashboard/lib/income-by-source";

export interface IncomeThisMonthCardLabels {
  sectionLabel: string;
  /** Already formatted with the month name, e.g. "รายได้เดือนตุลาคม". */
  title: string;
  /** Short month name, e.g. "ต.ค.". */
  monthShort: string;
  /** Contains {days}. */
  daysLeft: string;
  received: string;
  percentPrefix: string;
  /** Contains {percent}. */
  percentHighlight: string;
  /** Contains {amount}. */
  averagePerMonth: string;
  noHistoryHint: string;
  /** Contains {parts}. */
  barLabel: string;
  /** Contains {amount}. */
  barGapLabel: string;
  colSourceWithShare: string;
  colSource: string;
  colOfAverage: string;
  /** Contains {percent}. */
  shareSr: string;
  atAverage: string;
  /** Shown instead of "0%" when a source has an average but nothing yet this month. */
  notYet: string;
  volatilitySteady: string;
  volatilityModerate: string;
  volatilityHigh: string;
  /** Contains {months}, {min}, {max}. */
  range: string;
  /** Contains {months}, {min}, {max}. */
  rangeSr: string;
  /** Contains {name}. */
  concentration: string;
  concentrationCta: string;
  emptyTitle: string;
  emptyHint: string;
  emptyCta: string;
  /** Contains {month} (short). */
  listTitle: string;
  /** Contains {percent} and {amount}. */
  ofAverage: string;
  viewAll: string;
  viewAllSr: string;
  /** Contains {name}, {amount}, {average}. */
  progressSr: string;
}

export interface IncomeThisMonthCardProps {
  summary: IncomeBySourceSummary;
  daysLeft: number;
  currencyCode?: string;
  labels: IncomeThisMonthCardLabels;
}

/** Stable colors per rank (design palette), with dark-mode equivalents. */
const SLOT_COLORS: Record<IncomeSourceGroup["colorSlot"], string> = {
  0: "bg-[#204d3d] dark:bg-[#5fae8c]",
  1: "bg-[#c9a15a] dark:bg-[#d8b46f]",
  2: "bg-[#a4b49b] dark:bg-[#8a9c82]",
  3: "bg-[#7fd6b2] dark:bg-[#b5ead3]",
  other: "bg-muted-foreground/40",
};

const VIEW_ALL_HREF = "/money/transactions?type=income";

function money(cents: number, currencyCode?: string) {
  return formatMoney(cents, currencyCode, undefined, 0);
}

function fill(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, value), template);
}

/**
 * Presentational "income this month by source" list for Home (2026-10
 * "C — freelancer dashboard") — plain props only, so it renders with mock
 * data. Data loading lives in IncomeThisMonth (income-this-month.tsx);
 * every figure comes from the display-only aggregation in
 * lib/income-by-source.ts. Each metric hides itself independently when its
 * field is null.
 */
export function IncomeThisMonthCard({ summary, daysLeft, currencyCode, labels }: IncomeThisMonthCardProps) {
  const isEmpty = summary.thisMonthCents === 0 && summary.groups.length === 0;
  const title = labels.listTitle.replace("{month}", labels.monthShort);

  if (isEmpty) {
    return (
      <section aria-label={labels.sectionLabel}>
        <div className="rounded-[20px] border border-dashed bg-card px-5 py-6 text-card-foreground shadow-card">
          <h2 className="text-[13px] leading-5 font-medium text-muted-foreground">{title}</h2>
          {/* Four empty source dots — decoration only. */}
          <div aria-hidden="true" className="mt-3 flex gap-1.5">
            {[0, 1, 2, 3].map((slot) => (
              <span key={slot} className={cn("size-2 rounded-full opacity-35", SLOT_COLORS[slot])} />
            ))}
          </div>
          <p className="mt-2.5 text-[15px] leading-snug font-semibold">{labels.emptyTitle}</p>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{labels.emptyHint}</p>
          <Link
            href="/money/transactions"
            className="mt-4 inline-flex min-h-11 items-center gap-1 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {labels.emptyCta}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    );
  }

  const showShare = summary.groups.some((g) => g.sharePercent !== null);
  const volatilityText = summary.volatility
    ? {
        steady: labels.volatilitySteady,
        moderate: labels.volatilityModerate,
        high: labels.volatilityHigh,
      }[summary.volatility.level]
    : null;
  const rangeValues = summary.range
    ? {
        months: String(summary.range.months),
        min: money(summary.range.minCents, currencyCode),
        max: money(summary.range.maxCents, currencyCode),
      }
    : null;
  const daysLeftText = labels.daysLeft.replace("{days}", String(daysLeft));

  return (
    <section aria-label={labels.sectionLabel}>
      <div className="rounded-[20px] border bg-card px-[18px] pt-4 text-card-foreground shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[13px] leading-5 font-medium text-muted-foreground">{title}</h2>
            <p className="flex flex-wrap items-baseline gap-x-1.5">
              <SplitMoneyAmount
                cents={summary.thisMonthCents}
                currencyCode={currencyCode}
                className="text-xl leading-7 font-bold tracking-tight tabular-nums [overflow-wrap:anywhere]"
                decimalClassName="text-[0.6em] font-semibold text-muted-foreground"
              />
              <span className="sr-only">{labels.received}</span>
              {summary.receivedPercentOfAverage !== null && summary.averageCents !== null ? (
                <span className="text-xs leading-[18px] font-medium text-muted-foreground tabular-nums">
                  {fill(labels.ofAverage, {
                    percent: String(summary.receivedPercentOfAverage),
                    amount: money(summary.averageCents, currencyCode),
                  })}
                </span>
              ) : null}
            </p>
            <p className="text-[11.5px] leading-[17px] text-muted-foreground">
              {summary.receivedPercentOfAverage === null && summary.monthsInWindow < 2 ? labels.noHistoryHint : daysLeftText}
            </p>
          </div>
          <Link
            href={VIEW_ALL_HREF}
            className="-mr-1 inline-flex min-h-8 shrink-0 items-center gap-0.5 rounded-lg px-1 text-[13px] leading-5 font-medium whitespace-nowrap text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-[#8fd9b4]"
          >
            <span aria-hidden="true">{labels.viewAll}</span>
            <span className="sr-only">{labels.viewAllSr}</span>
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        {summary.groups.length > 0 ? (
          <ul className="mt-1.5">
            {summary.groups.map((g) => {
              const hasAverage = g.percentOfAverage !== null && g.averageCents !== null;
              return (
                <li key={g.key} className="border-t border-dashed border-border py-[9px] first:border-t-0">
                  <div className="flex items-center gap-2 text-[13.5px] leading-5">
                    <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", SLOT_COLORS[g.colorSlot])} />
                    <span className="flex min-w-0 flex-1 items-baseline gap-1">
                      <span className="min-w-0 truncate font-medium">{g.name}</span>
                      {showShare && g.sharePercent !== null ? (
                        <span className="shrink-0 text-[11.5px] text-muted-foreground tabular-nums">
                          <span aria-hidden="true">{g.sharePercent.toFixed(1)}%</span>
                          <span className="sr-only">{labels.shareSr.replace("{percent}", g.sharePercent.toFixed(1))}</span>
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 whitespace-nowrap tabular-nums",
                        g.thisMonthCents === 0 ? "font-medium text-muted-foreground" : "font-semibold"
                      )}
                    >
                      {money(g.thisMonthCents, currencyCode)}
                      {hasAverage ? (
                        <span className="text-[11.5px] font-normal text-muted-foreground">
                          {" "}
                          / {money(g.averageCents!, currencyCode)}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  {hasAverage ? (
                    <div className="mt-1.5 flex items-center gap-2.5 pl-4">
                      <div
                        role="img"
                        aria-label={fill(labels.progressSr, {
                          name: g.name,
                          amount: money(g.thisMonthCents, currencyCode),
                          average: money(g.averageCents!, currencyCode),
                        })}
                        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted dark:bg-white/10"
                      >
                        <span
                          className={cn("block h-full rounded-full", SLOT_COLORS[g.colorSlot])}
                          style={{ width: `${Math.min(100, g.percentOfAverage!)}%` }}
                        />
                      </div>
                      <span
                        className={cn(
                          "w-[76px] shrink-0 text-right text-[11.5px] leading-4 whitespace-nowrap tabular-nums",
                          g.reachedAverage ? "font-medium text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"
                        )}
                      >
                        {g.reachedAverage ? labels.atAverage : g.thisMonthCents === 0 ? labels.notYet : `${g.percentOfAverage}%`}
                      </span>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}

        {volatilityText || rangeValues ? (
          <div className="-mx-[18px] flex flex-wrap items-center gap-x-2 gap-y-1 border-t px-[18px] py-2.5 text-xs leading-[18px] text-muted-foreground">
            {volatilityText ? (
              <span className="rounded-full bg-[#e9eee3] px-2.5 py-0.5 font-medium text-[#4f6448] dark:bg-[#2c3a2e] dark:text-[#b7cdb0]">
                {volatilityText}
              </span>
            ) : null}
            {rangeValues ? (
              <span className="tabular-nums">
                <span aria-hidden="true">{fill(labels.range, rangeValues)}</span>
                <span className="sr-only">{fill(labels.rangeSr, rangeValues)}</span>
              </span>
            ) : null}
          </div>
        ) : null}

        {summary.concentration ? (
          <Link
            href="/earn"
            className="mb-3 flex min-h-11 items-center gap-2 rounded-xl bg-(--journal-note) px-3 py-2 text-[12.5px] leading-[18px] text-[#5d5233] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-amber-100/90"
          >
            <Lightbulb className="size-4 shrink-0 text-[#a88a45] dark:text-amber-300" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <b className="font-semibold text-foreground">
                {labels.concentration.replace("{name}", summary.concentration.name)}
              </b>{" "}
              · {labels.concentrationCta}
            </span>
            <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
          </Link>
        ) : (
          <div className="h-1.5" />
        )}
      </div>
    </section>
  );
}
