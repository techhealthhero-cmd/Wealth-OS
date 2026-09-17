import Link from "next/link";

import { getBudgetSummary } from "@/features/budget/queries";
import { getEmergencyFund, getEssentialMonthlyExpenses } from "@/features/emergency-fund/queries";
import { ensureTodaysWealthScore } from "@/features/wealth-score/queries";
import { getSafeToSpend } from "@/features/safe-to-spend/queries";
import { getLifeStageAndPriorities } from "@/features/life-stage/queries";
import { calculateMonthsProtected } from "@/lib/financial/emergency-fund";
import { parseMoneyToCents } from "@/lib/financial/money";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { getProfile } from "@/features/profile/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SafeToSpendCard } from "./safe-to-spend-card";
import { WealthScoreCard } from "./wealth-score-card";
import { LifeStageCard } from "./life-stage-card";

const STATUS_TONE: Record<string, string> = {
  no_budget: "text-muted-foreground",
  healthy: "text-emerald-600 dark:text-emerald-400",
  near_limit: "text-amber-600 dark:text-amber-400",
  over_budget: "text-destructive",
};

interface WealthOverviewData {
  dict: ReturnType<typeof getDictionary>;
  wealthScoreComputation: Awaited<ReturnType<typeof ensureTodaysWealthScore>>;
  budgetSummary: Awaited<ReturnType<typeof getBudgetSummary>>;
  emergencyFund: Awaited<ReturnType<typeof getEmergencyFund>>;
  essential: Awaited<ReturnType<typeof getEssentialMonthlyExpenses>>;
  safeToSpend: Awaited<ReturnType<typeof getSafeToSpend>>;
  lifeStageAndPriorities: Awaited<ReturnType<typeof getLifeStageAndPriorities>>;
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

    const [wealthScoreComputation, budgetSummary, emergencyFund, essential, safeToSpend, lifeStageAndPriorities] =
      await Promise.all([
        ensureTodaysWealthScore(),
        getBudgetSummary(),
        getEmergencyFund(),
        getEssentialMonthlyExpenses(),
        getSafeToSpend(),
        getLifeStageAndPriorities(),
      ]);

    return {
      dict,
      wealthScoreComputation,
      budgetSummary,
      emergencyFund,
      essential,
      safeToSpend,
      lifeStageAndPriorities,
    };
  } catch (error) {
    console.error("[WealthOverview] Failed to load Day 2 wealth engine data — has migration 0003 been applied?", error);
    return null;
  }
}

export async function WealthOverview() {
  const data = await loadWealthOverviewData();
  if (!data) return null;

  const { dict, wealthScoreComputation, budgetSummary, emergencyFund, essential, safeToSpend, lifeStageAndPriorities } = data;
  const emergencyFundCurrentCents = emergencyFund ? parseMoneyToCents(emergencyFund.current_amount) : 0;
  const monthsProtected = calculateMonthsProtected(emergencyFundCurrentCents, essential.cents);

  // UX guidelines #14 (personal relevance beats feature visibility): this
  // grid's cards are otherwise equal-weight, so whichever one matches the
  // user's actual current priority — from the existing deterministic
  // Priority Engine, never a second/invented prioritization — gets a
  // "soft" highlight instead of sitting identically to the rest. Only
  // covers the two priority types this grid actually has a card for
  // (emergency fund, cash-flow/savings-rate-driven budget attention); other
  // priority types (debt, goals, income) are already surfaced elsewhere
  // higher up the page (Next Best Action, Goal Progress).
  const priorityType = lifeStageAndPriorities.topPriority?.priorityType;
  const isEmergencyFundRelevant = priorityType === "no_emergency_fund";
  const isBudgetRelevant = priorityType === "negative_cash_flow" || priorityType === "low_savings_rate";

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <LifeStageCard data={lifeStageAndPriorities} />

      <WealthScoreCard computation={wealthScoreComputation} />

      <SafeToSpendCard computation={safeToSpend} />

      <Link href="/money/budget">
        <Card
          variant={isBudgetRelevant ? "soft" : "default"}
          className="card-interactive h-full transition-colors hover:bg-accent/50"
        >
          <CardContent className="space-y-1 pt-6">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">{dict.dashboard2.budgetStatus}</p>
              {isBudgetRelevant ? <Badge className="shrink-0 text-[10px]">{dict.dashboard2.relevantNow}</Badge> : null}
            </div>
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
        <Card
          variant={isEmergencyFundRelevant ? "soft" : "default"}
          className="card-interactive h-full transition-colors hover:bg-accent/50"
        >
          <CardContent className="space-y-1 pt-6">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">{dict.dashboard2.emergencyFund}</p>
              {isEmergencyFundRelevant ? <Badge className="shrink-0 text-[10px]">{dict.dashboard2.relevantNow}</Badge> : null}
            </div>
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
    </div>
  );
}
