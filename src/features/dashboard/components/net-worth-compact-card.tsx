import Link from "next/link";

import type { NetWorthChange } from "@/lib/financial/net-worth";
import { formatMoney } from "@/lib/financial/money";
import { cn } from "@/lib/utils";
import { pickSparklineLabels } from "../lib/sparkline-labels";
import { NetWorthMiniChart } from "./net-worth-mini-chart";
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
  /** Real net-worth snapshots, oldest first — drawn as a sparkline when >= 2. */
  chartData: { date: string; netWorth: number }[];
  /** One short month label per month covered by the chart, oldest first. */
  monthLabels: { label: string; isCurrent: boolean }[];
  currencyCode?: string;
}

/** Brand leather green, kept dark in both themes (the hero is always dark). */
const HERO_BACKGROUND =
  "radial-gradient(110% 100% at 100% 0%, #2d6650 0%, rgba(45,102,80,0) 60%), linear-gradient(180deg, #24533f 0%, #1b4335 60%, #173b30 100%)";

/**
 * Home's Net Worth hero (2026-10 "C — freelancer dashboard") — plain props
 * only. A dark leather-green card: the real net worth, the change since the
 * first snapshot in words (never an up/down arrow), and a sparkline of the
 * real snapshots. The whole card links to /money/net-worth, where the full
 * chart and the assets/liabilities breakdown live. Data comes from
 * NetWorthHero (net-worth-hero.tsx, variant="compact").
 */
export function NetWorthCompactCard({
  labels,
  netWorthCents,
  sinceFirst,
  chartData,
  monthLabels,
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
  // Kept as one unbreakable chunk so a long line wraps before it, never inside it.
  const percentText =
    sinceFirst && changeCents !== 0 && percent !== null ? `(${percent > 0 ? "+" : ""}${percent.toFixed(1)}%)` : null;
  const showChart = chartData.length >= 2;
  const axisLabels = pickSparklineLabels(monthLabels, 4);

  return (
    <section aria-label={labels.label}>
      <Link
        href="/money/net-worth"
        className="card-interactive group relative flex items-end justify-between gap-3 rounded-[20px] py-4 pr-4 pl-5 text-[#fffbf2] shadow-[0_1px_0_rgba(255,255,255,0.07)_inset,0_16px_28px_-20px_rgba(23,59,48,0.75)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        style={{ background: HERO_BACKGROUND }}
      >
        {/* Stitched leather edge — decoration only. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-[5px] rounded-2xl border-[1.5px] border-dashed border-[#fffbf2]/12"
        />
        <div className="relative min-w-0 flex-1">
          <p className="text-[13px] leading-5 font-medium text-[#fffbf2]/70">{labels.label}</p>
          <SplitMoneyAmount
            cents={netWorthCents}
            currencyCode={currencyCode}
            className={cn(
              "block text-[clamp(1.5rem,7.4vw,1.75rem)] leading-9 font-bold tracking-tight tabular-nums [overflow-wrap:anywhere]",
              netWorthCents < 0 && "text-[#f6d3b8]"
            )}
            decimalClassName="ml-px text-[0.55em] font-medium tracking-normal text-[#fffbf2]/60"
          />
          <p
            className={cn(
              "text-[12.5px] leading-5 tabular-nums",
              !sinceFirst || changeCents === 0
                ? "text-[#fffbf2]/70"
                : changeCents > 0
                  ? "text-[#7fd6b2]"
                  : "text-[#f6d3b8]"
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
        {showChart ? (
          <div className="relative flex w-[112px] shrink-0 flex-col gap-1">
            <NetWorthMiniChart data={chartData} tone="highlight" heightClassName="h-11" currencyCode={currencyCode} />
            {axisLabels.length >= 2 ? (
              <ol aria-hidden="true" className="flex justify-between text-[10px] leading-[14px] text-[#fffbf2]/50">
                {axisLabels.map((month, index) => (
                  <li key={`${month.label}-${index}`} className={cn(month.isCurrent && "font-semibold text-[#fffbf2]")}>
                    {month.label}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        ) : null}
        <span className="sr-only">{labels.viewAssetsAndLiabilities}</span>
      </Link>
    </section>
  );
}
