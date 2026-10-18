import { todayInTimeZone } from "@/lib/date";
import { previousMonthSnapshot } from "../net-worth-baseline";
import { captureError } from "@/lib/observability";
import {
  ensureTodaysNetWorthSnapshot,
  getNetWorthBreakdown,
  getNetWorthSnapshotsSince,
} from "@/features/net-worth/queries";
import { calculateNetWorthChange, type NetWorthChange } from "@/lib/financial/net-worth";
import { parseMoneyToCents } from "@/lib/financial/money";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import type { Locale } from "@/i18n/config";
import { getProfile } from "@/features/profile/queries";
import { InlineLoadError } from "@/components/shared/inline-load-error";
import { NetWorthHeroCard } from "./net-worth-hero-card";
import type { NetWorthBreakdown } from "@/features/net-worth/queries";

const CHART_HISTORY_MONTHS = 6;

interface NetWorthHeroData {
  dict: ReturnType<typeof getDictionary>;
  locale: Locale;
  breakdown: NetWorthBreakdown;
  change: NetWorthChange;
  hasHistory: boolean;
  chartData: { date: string; netWorth: number }[];
  monthLabels: { label: string; isCurrent: boolean }[];
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
    // Independent — load the profile and the net-worth figures together.
    const [profile, breakdown] = await Promise.all([getProfile(), getNetWorthBreakdown()]);
    const locale = await getLocale(profile?.preferred_language);
    const dict = getDictionary(locale);
    // Ensures at least today's row exists — previously only /money/net-worth
    // ever wrote a snapshot, so a user who only ever opens the dashboard
    // would never build up any history for this chart to show.
    await ensureTodaysNetWorthSnapshot(breakdown);
    const snapshots = await getNetWorthSnapshotsSince(CHART_HISTORY_MONTHS);

    const today = todayInTimeZone(profile?.timezone ?? "Asia/Bangkok");
    const previousSnapshot = previousMonthSnapshot(snapshots, today);
    const change = calculateNetWorthChange(
      breakdown.netWorthCents,
      previousSnapshot ? parseMoneyToCents(previousSnapshot.net_worth) : 0
    );

    const intlLocale = locale === "th" ? "th-TH" : "en-US";
    const chartData = snapshots.map((s) => ({
      date: new Intl.DateTimeFormat(intlLocale, { month: "short", day: "numeric" }).format(
        new Date(`${s.snapshot_date}T00:00:00`)
      ),
      netWorth: parseMoneyToCents(s.net_worth),
    }));

    // Axis labels under the sparkline: one per distinct snapshot month
    // (snapshot_date is "YYYY-MM-DD"), current month emphasized.
    const monthFormatter = new Intl.DateTimeFormat(intlLocale, { month: "short" });
    const currentMonthKey = today.slice(0, 7);
    const monthKeys = [...new Set(snapshots.map((s) => s.snapshot_date.slice(0, 7)))];
    const monthLabels = monthKeys.map((key) => ({
      label: monthFormatter.format(new Date(`${key}-01T00:00:00`)),
      isCurrent: key === currentMonthKey,
    }));

    return { dict, locale, breakdown, change, hasHistory: previousSnapshot !== null, chartData, monthLabels };
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
 * 2026-10 Home redesign: the presentation lives in NetWorthHeroCard; the
 * assets/liabilities breakdown is one tap away at /money/net-worth via the
 * card's row link instead of an in-place disclosure.
 */
export async function NetWorthHero() {
  const data = await loadNetWorthHeroData();
  if (!data) {
    // `data` is only ever null here from the catch block in
    // loadNetWorthHeroData() — a real fetch error, not a "no net worth
    // data yet" state (which the app treats as ฿0, still a valid
    // breakdown). getLocale()/getDictionary() are safe to call
    // independently even when the failure was inside getProfile() itself —
    // getLocale() falls back to the locale cookie or the Thai default,
    // no DB call required.
    const locale = await getLocale();
    const dict = getDictionary(locale);
    return <InlineLoadError message={dict.common.somethingWentWrong} />;
  }

  const { dict, breakdown, change, hasHistory, chartData, monthLabels } = data;

  return (
    <NetWorthHeroCard
      labels={{
        currentNetWorth: dict.netWorth.currentNetWorth,
        whatIsThis: dict.netWorth.whatIsThis,
        explanation: dict.netWorth.explanation,
        monthlyChange: dict.netWorth.monthlyChange,
        noChange: dict.netWorth.noChangeFromLastMonth,
        noHistoryYet: dict.netWorth.noHistoryYet,
        viewAssetsAndLiabilities: dict.netWorth.viewAssetsAndLiabilities,
      }}
      netWorthCents={breakdown.netWorthCents}
      change={change}
      hasHistory={hasHistory}
      chartData={chartData}
      monthLabels={monthLabels}
    />
  );
}
