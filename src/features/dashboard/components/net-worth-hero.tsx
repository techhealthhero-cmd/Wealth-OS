import Link from "next/link";
import { TrendingDown, TrendingUp, Wallet, CreditCard } from "lucide-react";

import { captureError } from "@/lib/observability";
import {
  ensureTodaysNetWorthSnapshot,
  getNetWorthBreakdown,
  getNetWorthSnapshotsSince,
} from "@/features/net-worth/queries";
import { calculateNetWorthChange, type NetWorthChange } from "@/lib/financial/net-worth";
import { formatMoney, parseMoneyToCents } from "@/lib/financial/money";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import type { Locale } from "@/i18n/config";
import { getProfile } from "@/features/profile/queries";
import { Card, CardContent } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { IconChip } from "@/components/shared/icon-chip";
import { ClickableCard } from "@/components/shared/clickable-card";
import { NetWorthMiniChart } from "./net-worth-mini-chart";
import { NetWorthInfoPopover } from "./net-worth-info-popover";
import type { NetWorthBreakdown } from "@/features/net-worth/queries";

const CHART_HISTORY_MONTHS = 6;

interface NetWorthHeroData {
  dict: ReturnType<typeof getDictionary>;
  locale: Locale;
  breakdown: NetWorthBreakdown;
  change: NetWorthChange;
  hasHistory: boolean;
  chartData: { date: string; netWorth: number }[];
}

/**
 * Depends on the Day 2 migration (0003_wealth_engine.sql) like the rest of
 * the wealth-engine dashboard sections — data loading is isolated in its own
 * try/catch (never inside JSX construction, which react-hooks/error-
 * boundaries flags — errors thrown while building JSX aren't actually
 * caught by a surrounding try/catch in React) so a not-yet-migrated
 * environment never 500s the whole dashboard; it just skips this section.
 */
async function loadNetWorthHeroData(): Promise<NetWorthHeroData | null> {
  try {
    const profile = await getProfile();
    const locale = await getLocale(profile?.preferred_language);
    const dict = getDictionary(locale);

    const breakdown = await getNetWorthBreakdown();
    // Ensures at least today's row exists — previously only /money/net-worth
    // ever wrote a snapshot, so a user who only ever opens the dashboard
    // would never build up any history for this chart to show.
    await ensureTodaysNetWorthSnapshot(breakdown);
    const snapshots = await getNetWorthSnapshotsSince(CHART_HISTORY_MONTHS);

    const previousSnapshot = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;
    const change = calculateNetWorthChange(
      breakdown.netWorthCents,
      previousSnapshot ? parseMoneyToCents(previousSnapshot.net_worth) : 0
    );

    const chartData = snapshots.map((s) => ({
      date: new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { month: "short", day: "numeric" }).format(
        new Date(`${s.snapshot_date}T00:00:00`)
      ),
      netWorth: parseMoneyToCents(s.net_worth),
    }));

    return { dict, locale, breakdown, change, hasHistory: previousSnapshot !== null, chartData };
  } catch (error) {
    captureError(error, { route: "dashboard.NetWorthHero", operation: "load_net_worth_hero_data" });
    return null;
  }
}

/**
 * UX reorg (2026-09): Net Worth promoted to a standalone hero — the first
 * thing a user sees, answering "am I becoming wealthier?" before any other
 * number competes for attention. Reuses the exact same deterministic
 * calculateNetWorthChange() already used on /money/net-worth (see
 * net-worth-view.tsx) — no new financial logic, just a second presentation
 * of the same numbers.
 */
export async function NetWorthHero() {
  const data = await loadNetWorthHeroData();
  if (!data) return null;

  const { dict, breakdown, change, hasHistory, chartData } = data;
  const isNegative = breakdown.netWorthCents < 0;

  const totalCents = breakdown.totalAssetsCents + breakdown.totalLiabilitiesCents;
  const assetsPercent = totalCents > 0 ? (breakdown.totalAssetsCents / totalCents) * 100 : 50;
  const liabilitiesPercent = 100 - assetsPercent;

  return (
    <div className="space-y-3">
      <ClickableCard href="/money/net-worth" ariaLabel={dict.netWorth.currentNetWorth}>
        <Card variant={isNegative ? "default" : "highlight"} className="card-interactive transition-opacity hover:opacity-90">
          <CardContent className="space-y-3 pt-6">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <p className={isNegative ? "text-sm text-muted-foreground" : "text-sm text-primary-foreground/70"}>
                  {dict.netWorth.currentNetWorth}
                </p>
                <NetWorthInfoPopover
                  label={dict.netWorth.whatIsThis}
                  explanation={dict.netWorth.explanation}
                  tone={isNegative ? "default" : "on-dark"}
                />
              </div>
              <AnimatedNumber
                value={breakdown.netWorthCents}
                formatAs="money"
                className={`block text-4xl font-bold ${isNegative ? "text-destructive" : ""}`}
              />
              {hasHistory ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                    isNegative
                      ? change.changeCents >= 0
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                      : change.changeCents >= 0
                        ? "bg-primary-foreground/15 text-[#7FD6B2]"
                        : "bg-primary-foreground/15 text-rose-300"
                  }`}
                >
                  {change.changeCents >= 0 ? (
                    <TrendingUp className="size-3.5" aria-hidden="true" />
                  ) : (
                    <TrendingDown className="size-3.5" aria-hidden="true" />
                  )}
                  {change.changeCents >= 0 ? "+" : ""}
                  {formatMoney(change.changeCents)}
                  {change.changePercent !== null
                    ? ` · ${change.changeCents >= 0 ? "+" : ""}${change.changePercent.toFixed(1)}%`
                    : ""}{" "}
                  {dict.netWorth.monthlyChange}
                </span>
              ) : (
                <p className={isNegative ? "text-sm text-muted-foreground" : "text-sm text-primary-foreground/60"}>
                  {dict.netWorth.noHistoryYet}
                </p>
              )}
            </div>

            {chartData.length >= 2 ? (
              <div className="space-y-1">
                <p className={isNegative ? "text-xs text-muted-foreground" : "text-xs text-primary-foreground/60"}>
                  {dict.netWorth.last6Months}
                </p>
                <NetWorthMiniChart data={chartData} tone={isNegative ? "default" : "highlight"} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </ClickableCard>

      <Link href="/money/net-worth">
        <Card className="card-interactive transition-opacity hover:opacity-90">
          <CardContent className="space-y-3 pt-6">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <IconChip icon={Wallet} tone="mint" className="size-8" />
                <div className="min-w-0">
                  <p className="truncate text-muted-foreground">{dict.netWorth.totalAssets}</p>
                  <p className="truncate font-medium">{formatMoney(breakdown.totalAssetsCents)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <IconChip icon={CreditCard} tone="rose" className="size-8" />
                <div className="min-w-0">
                  <p className="truncate text-muted-foreground">{dict.netWorth.totalLiabilities}</p>
                  <p className="truncate font-medium">{formatMoney(breakdown.totalLiabilitiesCents)}</p>
                </div>
              </div>
            </div>

            {totalCents > 0 ? (
              <div className="space-y-1.5">
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-[#7FD6B2]" style={{ width: `${assetsPercent}%` }} />
                  <div className="h-full bg-rose-400" style={{ width: `${liabilitiesPercent}%` }} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {assetsPercent.toFixed(0)}% {dict.netWorth.totalAssets}
                  </span>
                  <span>
                    {liabilitiesPercent.toFixed(0)}% {dict.netWorth.totalLiabilities}
                  </span>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
