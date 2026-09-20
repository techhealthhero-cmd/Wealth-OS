import { TrendingDown, TrendingUp } from "lucide-react";

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
import { ClickableCard } from "@/components/shared/clickable-card";
import { NetWorthMiniChart } from "./charts-lazy";
import { NetWorthInfoPopover } from "./net-worth-info-popover";
import { NetWorthBreakdownDisclosure } from "./net-worth-breakdown-disclosure";
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
 *
 * 2026-09 Home redesign: renders a SINGLE Card now — the assets/liabilities
 * breakdown that used to be a second, separate Card (always one tap away in
 * full at /money/net-worth anyway) is folded into a chevron-expand section
 * via NetWorthBreakdownDisclosure, collapsed by default.
 */
export async function NetWorthHero() {
  const data = await loadNetWorthHeroData();
  if (!data) return null;

  const { dict, breakdown, change, hasHistory, chartData } = data;
  const isNegative = breakdown.netWorthCents < 0;

  return (
    <ClickableCard href="/money/net-worth" ariaLabel={dict.netWorth.currentNetWorth}>
      <Card variant={isNegative ? "default" : "highlight"} className="card-interactive rounded-3xl transition-opacity hover:opacity-90">
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-1">
                <p className={isNegative ? "text-sm text-muted-foreground" : "text-sm text-primary-foreground/70"}>
                  {dict.netWorth.currentNetWorth}
                </p>
                <NetWorthInfoPopover
                  label={dict.netWorth.whatIsThis}
                  explanation={dict.netWorth.explanation}
                  tone={isNegative ? "default" : "on-dark"}
                />
              </div>
              {!isNegative ? (
                <p className="max-w-36 text-right text-xs leading-relaxed text-primary-foreground/60">
                  {dict.netWorth.tagline}
                </p>
              ) : null}
            </div>
            <AnimatedNumber
              value={breakdown.netWorthCents}
              formatAs="money"
              className={`block break-all text-[clamp(2rem,10vw,3.75rem)] font-bold leading-none tracking-tight tabular-nums ${isNegative ? "text-destructive" : ""}`}
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

          <NetWorthBreakdownDisclosure
            totalAssetsCents={breakdown.totalAssetsCents}
            totalLiabilitiesCents={breakdown.totalLiabilitiesCents}
            viewDetailsLabel={dict.dashboard2.viewDetails}
            assetsLabel={dict.netWorth.totalAssets}
            liabilitiesLabel={dict.netWorth.totalLiabilities}
            tone={isNegative ? "default" : "on-dark"}
          />
        </CardContent>
      </Card>
    </ClickableCard>
  );
}
