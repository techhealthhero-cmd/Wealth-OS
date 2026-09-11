import Link from "next/link";

import { getNetWorthBreakdown } from "@/features/net-worth/queries";
import { getBudgetSummary } from "@/features/budget/queries";
import { getEmergencyFund, getEssentialMonthlyExpenses } from "@/features/emergency-fund/queries";
import { getGoals } from "@/features/goals/queries";
import { ensureTodaysWealthScore } from "@/features/wealth-score/queries";
import { getSafeToSpend } from "@/features/safe-to-spend/queries";
import { calculateMonthsProtected } from "@/lib/financial/emergency-fund";
import { calculateGoalProgress } from "@/lib/financial/goals";
import { formatMoney, parseMoneyToCents } from "@/lib/financial/money";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { getProfile } from "@/features/profile/queries";
import { Card, CardContent } from "@/components/ui/card";
import { SafeToSpendCard } from "./safe-to-spend-card";
import { WealthScoreCard } from "./wealth-score-card";

const STATUS_TONE: Record<string, string> = {
  no_budget: "text-muted-foreground",
  healthy: "text-emerald-600 dark:text-emerald-400",
  near_limit: "text-amber-600 dark:text-amber-400",
  over_budget: "text-destructive",
};

interface WealthOverviewData {
  dict: ReturnType<typeof getDictionary>;
  wealthScoreComputation: Awaited<ReturnType<typeof ensureTodaysWealthScore>>;
  netWorth: Awaited<ReturnType<typeof getNetWorthBreakdown>>;
  budgetSummary: Awaited<ReturnType<typeof getBudgetSummary>>;
  emergencyFund: Awaited<ReturnType<typeof getEmergencyFund>>;
  essential: Awaited<ReturnType<typeof getEssentialMonthlyExpenses>>;
  topGoal: Awaited<ReturnType<typeof getGoals>>[number] | null;
  safeToSpend: Awaited<ReturnType<typeof getSafeToSpend>>;
}

/**
 * Every query here depends on the Day 2 migration (0003_wealth_engine.sql)
 * being applied. If it isn't applied yet in a given environment, these
 * tables don't exist and every query below throws — that must never take
 * down the whole dashboard (a Day 1 page that already works standalone).
 * Caught and logged server-side; the section simply doesn't render rather
 * than 500ing the page. This is a deployment-order safeguard, not a
 * permanent design choice — see PROJECT_STATUS.md "Known limitations".
 */
async function loadWealthOverviewData(): Promise<WealthOverviewData | null> {
  try {
    const profile = await getProfile();
    const locale = await getLocale(profile?.preferred_language);
    const dict = getDictionary(locale);

    const [wealthScoreComputation, netWorth, budgetSummary, emergencyFund, essential, goals, safeToSpend] =
      await Promise.all([
        ensureTodaysWealthScore(),
        getNetWorthBreakdown(),
        getBudgetSummary(),
        getEmergencyFund(),
        getEssentialMonthlyExpenses(),
        getGoals(),
        getSafeToSpend(),
      ]);

    return { dict, wealthScoreComputation, netWorth, budgetSummary, emergencyFund, essential, topGoal: goals[0] ?? null, safeToSpend };
  } catch (error) {
    console.error("[WealthOverview] Failed to load Day 2 wealth engine data — has migration 0003 been applied?", error);
    return null;
  }
}

export async function WealthOverview() {
  const data = await loadWealthOverviewData();
  if (!data) return null;

  const { dict, wealthScoreComputation, netWorth, budgetSummary, emergencyFund, essential, topGoal, safeToSpend } = data;
  const emergencyFundCurrentCents = emergencyFund ? parseMoneyToCents(emergencyFund.current_amount) : 0;
  const monthsProtected = calculateMonthsProtected(emergencyFundCurrentCents, essential.cents);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <WealthScoreCard computation={wealthScoreComputation} />

      <Link href="/money/net-worth">
        <Card className="h-full transition-colors hover:bg-accent/50">
          <CardContent className="space-y-1 pt-6">
            <p className="text-sm text-muted-foreground">{dict.dashboard2.netWorth}</p>
            <p className={`text-2xl font-bold ${netWorth.netWorthCents < 0 ? "text-destructive" : ""}`}>
              {formatMoney(netWorth.netWorthCents)}
            </p>
          </CardContent>
        </Card>
      </Link>

      <SafeToSpendCard computation={safeToSpend} />

      <Link href="/money/budget">
        <Card className="h-full transition-colors hover:bg-accent/50">
          <CardContent className="space-y-1 pt-6">
            <p className="text-sm text-muted-foreground">{dict.dashboard2.budgetStatus}</p>
            {budgetSummary ? (
              <>
                <p className={`text-2xl font-bold ${STATUS_TONE[budgetSummary.overall.status]}`}>
                  {budgetSummary.overall.percentUsed.toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground">{dict.budget.status[budgetSummary.overall.status]}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{dict.budget.emptyTitle}</p>
            )}
          </CardContent>
        </Card>
      </Link>

      <Link href="/plan/emergency-fund">
        <Card className="h-full transition-colors hover:bg-accent/50">
          <CardContent className="space-y-1 pt-6">
            <p className="text-sm text-muted-foreground">{dict.dashboard2.emergencyFund}</p>
            {emergencyFund ? (
              <p className="text-2xl font-bold">
                {monthsProtected.toFixed(1)}
                <span className="text-sm font-normal text-muted-foreground"> {dict.emergencyFund.months}</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{dict.emergencyFund.notSetUp}</p>
            )}
          </CardContent>
        </Card>
      </Link>

      <Link href="/plan/goals">
        <Card className="h-full transition-colors hover:bg-accent/50">
          <CardContent className="space-y-1 pt-6">
            <p className="text-sm text-muted-foreground">{dict.dashboard2.topGoal}</p>
            {topGoal ? (
              <>
                <p className="truncate text-lg font-semibold">{topGoal.name}</p>
                <p className="text-sm text-muted-foreground">
                  {calculateGoalProgress(
                    parseMoneyToCents(topGoal.current_amount),
                    parseMoneyToCents(topGoal.target_amount)
                  ).toFixed(0)}
                  %
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{dict.goals.emptyTitle}</p>
            )}
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
