import Link from "next/link";

import type { NetWorthChange } from "@/lib/financial/net-worth";
import { formatMoney } from "@/lib/financial/money";
import { cn } from "@/lib/utils";

export interface NetWorthCompactCardProps {
  labels: {
    label: string;
    details: string;
    /** Contains {amount}. */
    thisYearUp: string;
    /** Contains {amount}. */
    thisYearDown: string;
    thisYearSame: string;
    /** Contains {month} and {amount}. */
    sinceUp: string;
    /** Contains {month} and {amount}. */
    sinceDown: string;
    /** Contains {month}. */
    sinceSame: string;
    noHistoryYet: string;
    /** Contains {month} and {amount}. */
    monthSpent: string;
    /** Screen-reader name of the link target. */
    viewAssetsAndLiabilities: string;
  };
  netWorthCents: number;
  /**
   * Change against a real snapshot. `year` is a baseline on or just before
   * 1 Jan. `since` is a later first snapshot and must not be called "this year".
   */
  delta: { scope: "year" | "since"; monthLabel: string; change: NetWorthChange } | null;
  /** This calendar month's expenses. Null when unknown or zero. */
  monthSpend: { monthLabel: string; cents: number } | null;
  currencyCode?: string;
}

/** Brand leather green, kept dark in both themes (the hero is always dark). */
const HERO_BACKGROUND =
  "radial-gradient(110% 100% at 100% 0%, #2d6650 0%, rgba(45,102,80,0) 60%), linear-gradient(180deg, #24533f 0%, #1b4335 60%, #173b30 100%)";

function wholeOrCents(cents: number, currencyCode: string | undefined): string {
  return formatMoney(Math.abs(cents), currencyCode, currencyCode === "THB" ? "th-TH" : undefined, cents % 100 === 0 ? 0 : 2);
}

/**
 * Home net worth (Variant B). A compact leather-green card: the real net
 * worth, the change this year when a snapshot supports it, and this month's
 * spend. The whole card opens /money/net-worth.
 */
export function NetWorthCompactCard({
  labels,
  netWorthCents,
  delta,
  monthSpend,
  currencyCode,
}: NetWorthCompactCardProps) {
  const changeCents = delta?.change.changeCents ?? 0;
  const amount = wholeOrCents(changeCents, currencyCode);
  let deltaText: string | null = null;
  if (delta) {
    if (changeCents === 0) {
      deltaText = delta.scope === "year" ? labels.thisYearSame : labels.sinceSame.replace("{month}", delta.monthLabel);
    } else if (delta.scope === "year") {
      deltaText = (changeCents > 0 ? labels.thisYearUp : labels.thisYearDown).replace("{amount}", amount);
    } else {
      deltaText = (changeCents > 0 ? labels.sinceUp : labels.sinceDown)
        .replace("{month}", delta.monthLabel)
        .replace("{amount}", amount);
    }
  }
  const tone = !delta || changeCents === 0 ? "flat" : changeCents > 0 ? "up" : "down";
  const showMark = delta?.scope === "year" && changeCents !== 0;
  const monthText = monthSpend
    ? labels.monthSpent.replace("{month}", monthSpend.monthLabel).replace("{amount}", wholeOrCents(monthSpend.cents, currencyCode))
    : null;
  const figure = formatMoney(netWorthCents, currencyCode, currencyCode === "THB" ? "th-TH" : undefined, netWorthCents % 100 === 0 ? 0 : 2);

  return (
    <section aria-label={labels.label} data-testid="home-net-worth">
      <Link
        href="/money/net-worth"
        className="card-interactive group relative block rounded-[20px] px-5 py-4 text-[#fffbf2] shadow-[0_1px_0_rgba(255,255,255,0.07)_inset,0_16px_28px_-20px_rgba(23,59,48,0.75)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        style={{ background: HERO_BACKGROUND }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-[5px] rounded-2xl border-[1.5px] border-dashed border-[#fffbf2]/12"
        />
        <span className="relative flex items-center justify-between gap-3">
          <span className="text-[13px] leading-5 font-medium text-[#fffbf2]/70">{labels.label}</span>
          <span className="shrink-0 text-[13px] font-medium text-[#fffbf2]/80">{labels.details}</span>
        </span>
        <span
          className={cn(
            "relative mt-1 block text-[clamp(1.75rem,8vw,2.125rem)] leading-none font-bold tracking-tight tabular-nums",
            netWorthCents < 0 && "text-[#f6d3b8]",
          )}
        >
          {figure}
        </span>
        {deltaText || monthText ? (
          <span className="relative mt-2 flex flex-wrap items-baseline gap-x-1.5 text-[12.5px] leading-5">
            {deltaText ? (
              <span className={cn(tone === "up" && "text-[#7fd6b2]", tone === "down" && "text-[#f6d3b8]", tone === "flat" && "text-[#fffbf2]/70")}>
                {showMark ? <span aria-hidden="true">{tone === "up" ? "▲ " : "▼ "}</span> : null}
                {deltaText}
              </span>
            ) : null}
            {deltaText && monthText ? (
              <span aria-hidden="true" className="text-[#fffbf2]/45">
                ·
              </span>
            ) : null}
            {monthText ? <span className="text-[#fffbf2]/80">{monthText}</span> : null}
          </span>
        ) : (
          <span className="relative mt-2 block text-[12.5px] leading-5 text-[#fffbf2]/70">{labels.noHistoryYet}</span>
        )}
        <span className="sr-only">{labels.viewAssetsAndLiabilities}</span>
      </Link>
    </section>
  );
}
