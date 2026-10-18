import Link from "next/link";
import { ChevronRight, TrendingDown, TrendingUp } from "lucide-react";

import type { NetWorthChange } from "@/lib/financial/net-worth";
import { formatMoney } from "@/lib/financial/money";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { NetWorthMiniChart } from "./net-worth-mini-chart";
import { NetWorthInfoPopover } from "./net-worth-info-popover";
import { SplitMoneyAmount } from "./split-money-amount";

export interface NetWorthHeroCardProps {
  labels: {
    currentNetWorth: string;
    whatIsThis: string;
    explanation: string;
    monthlyChange: string;
    noChange: string;
    noHistoryYet: string;
    viewAssetsAndLiabilities: string;
  };
  netWorthCents: number;
  change: NetWorthChange;
  hasHistory: boolean;
  chartData: { date: string; netWorth: number }[];
  /** One short month label per month covered by the chart, oldest first. */
  monthLabels: { label: string; isCurrent: boolean }[];
}

/**
 * Presentational Net Worth hero — plain props only, so it renders with mock
 * data. Data loading stays in NetWorthHero (net-worth-hero.tsx).
 *
 * Requested (2026-09-29): ALWAYS the green card; a negative figure reads
 * through the minus sign + soft rose, never as an alarm (UX #8).
 */
export function NetWorthHeroCard({
  labels,
  netWorthCents,
  change,
  hasHistory,
  chartData,
  monthLabels,
}: NetWorthHeroCardProps) {
  const isNegative = netWorthCents < 0;
  const isUp = change.changeCents > 0;
  const pillText =
    change.changeCents === 0
      ? labels.noChange
      : `${isUp ? "+" : ""}${formatMoney(change.changeCents)}${
          change.changePercent !== null ? ` · ${isUp ? "+" : ""}${change.changePercent.toFixed(1)}%` : ""
        }`;

  return (
    <section aria-label={labels.currentNetWorth}>
      <Card
        variant="highlight"
        className="card-interactive relative overflow-hidden rounded-3xl"
        style={{
          background:
            "radial-gradient(120% 90% at 100% 0%, rgba(255,255,255,0.14), transparent 55%), linear-gradient(145deg, var(--primary), color-mix(in oklab, var(--primary) 72%, black))",
        }}
      >
        {/* Soft decorative glow, purely visual. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -bottom-20 size-56 rounded-full bg-[#7FD6B2]/10 blur-2xl"
        />
        <CardContent className="relative space-y-4 pt-6">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1">
                <p className="text-sm text-primary-foreground/75">{labels.currentNetWorth}</p>
                <NetWorthInfoPopover label={labels.whatIsThis} explanation={labels.explanation} tone="on-dark" />
              </div>
              {hasHistory ? (
                <span
                  className={cn(
                    "inline-flex min-w-0 shrink items-center gap-1 rounded-full bg-primary-foreground/15 px-2.5 py-1 text-right text-xs font-medium tabular-nums",
                    change.changeCents === 0
                      ? "text-primary-foreground/90"
                      : isUp
                        ? "text-[#7FD6B2]"
                        : "text-rose-200"
                  )}
                >
                  {change.changeCents > 0 ? <TrendingUp className="size-3.5 shrink-0" aria-hidden="true" /> : null}
                  {change.changeCents < 0 ? <TrendingDown className="size-3.5 shrink-0" aria-hidden="true" /> : null}
                  {change.changeCents !== 0 ? <span className="sr-only">{labels.monthlyChange}: </span> : null}
                  {pillText}
                </span>
              ) : null}
            </div>
            <SplitMoneyAmount
              cents={netWorthCents}
              className={cn(
                "block break-all text-[clamp(2rem,10vw,3.25rem)] font-bold leading-none tracking-tight tabular-nums",
                isNegative ? "text-rose-200" : "text-primary-foreground"
              )}
              decimalClassName="ml-0.5 text-[0.5em] font-semibold opacity-80"
            />
            {!hasHistory ? <p className="text-sm text-primary-foreground/60">{labels.noHistoryYet}</p> : null}
          </div>

          {chartData.length >= 2 ? (
            <div className="space-y-1.5">
              <NetWorthMiniChart data={chartData} tone="highlight" />
              {monthLabels.length >= 2 ? (
                <ol aria-hidden="true" className="flex justify-between text-[11px] text-primary-foreground/60">
                  {monthLabels.map((month, index) => (
                    <li
                      key={`${month.label}-${index}`}
                      className={cn(month.isCurrent && "font-semibold text-primary-foreground")}
                    >
                      {month.label}
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          ) : null}

          <Link
            href="/money/net-worth"
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl bg-primary-foreground/10 px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70"
          >
            {labels.viewAssetsAndLiabilities}
            <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
          </Link>
        </CardContent>
      </Card>
    </section>
  );
}
