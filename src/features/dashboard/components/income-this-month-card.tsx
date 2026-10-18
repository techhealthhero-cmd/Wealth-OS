import Link from "next/link";
import { ChevronRight, Lightbulb, Wallet } from "lucide-react";

import type { IncomeBySourceSummary, IncomeSourceGroup } from "@/features/dashboard/lib/income-by-source";
import { Card, CardContent } from "@/components/ui/card";
import { IconChip } from "@/components/shared/icon-chip";
import { formatMoney } from "@/lib/financial/money";
import { cn } from "@/lib/utils";
import { SplitMoneyAmount } from "./split-money-amount";

export type { IncomeBySourceSummary, IncomeSourceGroup } from "@/features/dashboard/lib/income-by-source";

export interface IncomeThisMonthCardLabels {
  sectionLabel: string;
  /** Already formatted with the month name, e.g. "รายได้เดือนตุลาคม". */
  title: string;
  /** Short month name for the "this month" column header, e.g. "ต.ค.". */
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

const GAP_HATCH =
  "repeating-linear-gradient(135deg, color-mix(in oklab, var(--muted-foreground) 22%, transparent) 0 5px, transparent 5px 10px)";

function money(cents: number, currencyCode?: string) {
  return formatMoney(cents, currencyCode, undefined, 0);
}

/**
 * Presentational "income this month by source" card for Home — plain props
 * only, so it renders with mock data. Data loading lives in
 * IncomeThisMonth (income-this-month.tsx); every figure comes from the
 * display-only aggregation in lib/income-by-source.ts. Each metric hides
 * itself independently when its field is null.
 */
export function IncomeThisMonthCard({ summary, daysLeft, currencyCode, labels }: IncomeThisMonthCardProps) {
  const isEmpty = summary.thisMonthCents === 0 && summary.groups.length === 0;

  if (isEmpty) {
    return (
      <section aria-label={labels.sectionLabel}>
        <Card className="rounded-[20px] border-dashed">
          <CardContent className="flex flex-col items-center gap-3 px-5 py-8 text-center">
            <IconChip icon={Wallet} tone="lavender" className="size-10" />
            <div className="space-y-1">
              <h2 className="font-semibold">{labels.title}</h2>
              <p className="text-sm font-medium">{labels.emptyTitle}</p>
              <p className="text-sm text-muted-foreground">{labels.emptyHint}</p>
            </div>
            <Link
              href="/money/transactions"
              className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {labels.emptyCta}
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>
      </section>
    );
  }

  const barGroups = summary.groups.filter((g) => g.thisMonthCents > 0);
  const gap = summary.gapToAverageCents;
  const showBar = barGroups.length > 0 || gap !== null;
  const barParts = barGroups.map((g) => `${g.name} ${money(g.thisMonthCents, currencyCode)}`).join(", ");
  const barLabel = [
    labels.barLabel.replace("{parts}", barParts || money(0, currencyCode)),
    gap !== null ? labels.barGapLabel.replace("{amount}", money(gap, currencyCode)) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const showShare = summary.groups.some((g) => g.sharePercent !== null);
  const showPercentColumn = summary.groups.some((g) => g.percentOfAverage !== null);

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
  const fill = (template: string, values: Record<string, string>) =>
    Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, value), template);

  return (
    <section aria-label={labels.sectionLabel}>
      <Card className="rounded-[20px] py-5">
        <CardContent className="px-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="min-w-0 truncate text-sm font-semibold">{labels.title}</h2>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {labels.daysLeft.replace("{days}", String(daysLeft))}
            </span>
          </div>

          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <SplitMoneyAmount
              cents={summary.thisMonthCents}
              currencyCode={currencyCode}
              className="break-all text-[clamp(2rem,10vw,2.5rem)] font-bold leading-tight tracking-tight tabular-nums"
              decimalClassName="ml-0.5 text-[0.45em] font-semibold text-muted-foreground"
            />
            <span className="text-sm font-medium text-muted-foreground">{labels.received}</span>
          </p>

          {summary.receivedPercentOfAverage !== null && summary.averageCents !== null ? (
            <p className="text-[13px] leading-5 text-muted-foreground">
              {labels.percentPrefix}{" "}
              {/* Light: soft highlighter stroke behind ink text. Dark: a subtle
                  gold tint behind light text (AA contrast on the dark card). */}
              <mark className="rounded-[2px] bg-transparent bg-[linear-gradient(transparent_45%,rgba(233,207,122,.55)_45%)] px-0.5 font-semibold text-foreground dark:bg-none dark:bg-[rgba(201,161,90,.28)] dark:text-amber-50">
                {labels.percentHighlight.replace("{percent}", String(summary.receivedPercentOfAverage))}
              </mark>{" "}
              <span className="tabular-nums">
                {labels.averagePerMonth.replace("{amount}", money(summary.averageCents, currencyCode))}
              </span>
            </p>
          ) : summary.monthsInWindow < 2 ? (
            <p className="text-[13px] leading-5 text-muted-foreground">{labels.noHistoryHint}</p>
          ) : null}

          {showBar ? (
            <div role="img" aria-label={barLabel} className="mt-3.5 flex h-3.5 gap-1 overflow-hidden rounded-full">
              {barGroups.map((g) => (
                <span
                  key={g.key}
                  className={cn("h-full min-w-1 first:rounded-l-full last:rounded-r-full", SLOT_COLORS[g.colorSlot])}
                  style={{ flexGrow: g.thisMonthCents, flexBasis: 0 }}
                />
              ))}
              {gap !== null ? (
                <span
                  className="h-full min-w-1 bg-muted first:rounded-l-full last:rounded-r-full"
                  style={{ flexGrow: gap, flexBasis: 0, backgroundImage: GAP_HATCH }}
                />
              ) : null}
            </div>
          ) : null}

          {summary.groups.length > 0 ? (
            // Auto layout: the numeric columns shrink to their content (w-px +
            // nowrap, so an amount never overlaps or clips) and the name column
            // takes the rest, wrapping to 2 lines under pressure instead.
            <table className="mt-2.5 w-full border-collapse text-sm">
              <thead>
                <tr className="text-[11px] leading-4 text-muted-foreground">
                  <th scope="col" className="pb-1 text-left font-normal">
                    {showShare ? labels.colSourceWithShare : labels.colSource}
                  </th>
                  <th scope="col" className="w-px whitespace-nowrap pb-1 pl-3 text-right font-normal">
                    {labels.monthShort}
                  </th>
                  {showPercentColumn ? (
                    <th scope="col" className="w-px whitespace-nowrap pb-1 pl-3 text-right font-normal">
                      {labels.colOfAverage}
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {summary.groups.map((g) => (
                  <tr key={g.key} className="h-9 border-t border-dashed border-border/70 first:border-t-0">
                    <th scope="row" className="py-1.5 text-left font-medium">
                      <span className="flex min-w-0 items-start gap-2">
                        <span
                          aria-hidden="true"
                          className={cn("mt-1.5 size-2 shrink-0 rounded-full", SLOT_COLORS[g.colorSlot])}
                        />
                        <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
                          <span className="line-clamp-2 min-w-0 [overflow-wrap:anywhere]">{g.name}</span>
                          {showShare && g.sharePercent !== null ? (
                            <span className="text-[11.5px] font-normal whitespace-nowrap text-muted-foreground tabular-nums">
                              <span aria-hidden="true">{g.sharePercent.toFixed(1)}%</span>
                              <span className="sr-only">{labels.shareSr.replace("{percent}", g.sharePercent.toFixed(1))}</span>
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </th>
                    <td
                      className={cn(
                        "w-px whitespace-nowrap py-1.5 pl-3 text-right tabular-nums",
                        g.thisMonthCents === 0 ? "font-medium text-muted-foreground" : "font-semibold"
                      )}
                    >
                      {money(g.thisMonthCents, currencyCode)}
                    </td>
                    {showPercentColumn ? (
                      <td
                        className={cn(
                          "w-px whitespace-nowrap py-1.5 pl-3 text-right text-xs tabular-nums",
                          g.reachedAverage ? "font-medium text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"
                        )}
                      >
                        {g.reachedAverage
                          ? labels.atAverage
                          : g.percentOfAverage === null
                            ? null
                            : g.thisMonthCents === 0
                              ? labels.notYet
                              : `${g.percentOfAverage}%`}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {volatilityText || rangeValues ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/70 pt-3 text-[12.5px] leading-5 text-muted-foreground">
              {volatilityText ? (
                <span className="rounded-full bg-secondary px-2.5 py-0.5 font-medium text-secondary-foreground">
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
              className="mt-2.5 flex min-h-11 items-center gap-2 rounded-xl bg-(--journal-note) px-3 py-2 text-[12.5px] leading-[18px] text-[#5d5233] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-amber-100/90"
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
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
