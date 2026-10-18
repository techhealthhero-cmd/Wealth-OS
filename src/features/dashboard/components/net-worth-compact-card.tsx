import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { NetWorthChange } from "@/lib/financial/net-worth";
import { formatMoney } from "@/lib/financial/money";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SplitMoneyAmount } from "./split-money-amount";

export interface NetWorthCompactCardProps {
  labels: {
    label: string;
    /** Contains {month} and {amount}. */
    sinceUp: string;
    /** Contains {month} and {amount}. */
    sinceDown: string;
    /** Contains {month}. */
    sinceSame: string;
    noHistoryYet: string;
    /** Screen-reader name of the link target. */
    viewAssetsAndLiabilities: string;
  };
  netWorthCents: number;
  /**
   * Change from the first snapshot in the chart window to now; null when
   * there are fewer than 2 snapshots.
   */
  sinceFirst: { monthLabel: string; change: NetWorthChange } | null;
  /** Snapshot values (cents), oldest first — drawn as a sparkline when >= 2. */
  sparkline: number[];
  currencyCode?: string;
}

function sparklinePath(values: number[]): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  return values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${(44 - ((v - min) / range) * 40).toFixed(2)}`)
    .join(" ");
}

/**
 * Compact Net Worth row for Home (2026-10 freelancer redesign) — plain props
 * only. The whole card links to /money/net-worth, where the full hero chart
 * and assets/liabilities breakdown live. Data comes from the same loader as
 * NetWorthHero (net-worth-hero.tsx, variant="compact").
 */
export function NetWorthCompactCard({
  labels,
  netWorthCents,
  sinceFirst,
  sparkline,
  currencyCode,
}: NetWorthCompactCardProps) {
  const changeCents = sinceFirst?.change.changeCents ?? 0;
  const percent = sinceFirst?.change.changePercent ?? null;
  const changeText = sinceFirst
    ? changeCents === 0
      ? labels.sinceSame.replace("{month}", sinceFirst.monthLabel)
      : (changeCents > 0 ? labels.sinceUp : labels.sinceDown)
          .replace("{month}", sinceFirst.monthLabel)
          .replace("{amount}", formatMoney(Math.abs(changeCents), currencyCode, undefined, 0))
    : labels.noHistoryYet;
  // Kept as one unbreakable chunk so a very long line wraps before it, never inside it.
  const percentText =
    sinceFirst && changeCents !== 0 && percent !== null ? `(${percent > 0 ? "+" : ""}${percent.toFixed(1)}%)` : null;
  const points = sparkline.length >= 2 ? sparklinePath(sparkline) : null;

  return (
    <section aria-label={labels.label}>
      <Link
        href="/money/net-worth"
        className="block rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Card className="card-interactive rounded-[20px] py-3">
          {/* The sparkline sits beside the label/amount only, so the change
              line below gets the full text width (one line at 390px for
              typical values; wraps gracefully for very long ones). */}
          <div className="flex items-center gap-2 px-5 pr-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">{labels.label}</p>
                  <SplitMoneyAmount
                    cents={netWorthCents}
                    currencyCode={currencyCode}
                    className={cn(
                      "block break-all text-xl font-bold leading-7 tracking-tight tabular-nums",
                      netWorthCents < 0 && "text-[#B23A48] dark:text-rose-300"
                    )}
                    decimalClassName="text-[0.65em] font-semibold text-muted-foreground"
                  />
                </div>
                {points ? (
                  <svg
                    aria-hidden="true"
                    className="mb-1 h-8 w-[88px] shrink-0 overflow-visible text-emerald-700 dark:text-emerald-300"
                    viewBox="0 0 100 48"
                    preserveAspectRatio="none"
                  >
                    <polygon points={`0,48 ${points} 100,48`} fill="currentColor" opacity="0.1" />
                    <polyline
                      points={points}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                ) : null}
              </div>
              <p
                className={cn(
                  "text-[11.5px] leading-4 tabular-nums",
                  !sinceFirst || changeCents === 0
                    ? "text-muted-foreground"
                    : changeCents > 0
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-[#B23A48] dark:text-rose-300"
                )}
              >
                {changeText}
                {percentText ? (
                  <>
                    {" "}
                    <span className="whitespace-nowrap">{percentText}</span>
                  </>
                ) : null}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">{labels.viewAssetsAndLiabilities}</span>
          </div>
        </Card>
      </Link>
    </section>
  );
}
