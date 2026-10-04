import "server-only";

import { getProfile } from "@/features/profile/queries";
import { getFinancialPriority } from "@/features/ai/tools";
import { getVisibleInsights } from "@/features/ai/lib/insights";
import { buildNextBestActionText } from "@/features/ai/lib/next-best-action";
import { getBudgetSummary } from "@/features/budget/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { formatMoney } from "@/lib/financial/money";
import { pickCompanionTip, type TipInsightType } from "@/lib/companions/tips";
import type { CompanionDefinition } from "@/lib/companions/catalog";
import { getCompanionUnlockFacts } from "./queries";

export interface CompanionTipResult {
  companionId: string;
  text: string;
  href: string | null;
  /** True when there was genuinely nothing to raise (the calm fallback line). */
  allGood: boolean;
}

/**
 * Renders the companion's one real-data tip in the user's language. Not a
 * Server Action and not plan-gated by itself: callers decide — the
 * proactive speech bubble is Plus/Pro (`getCompanionTip`), while the AI
 * window's greeting shows it to everyone (it's the same data the dashboard
 * already shows on every plan).
 */
export async function buildCompanionTip(companion: CompanionDefinition): Promise<CompanionTipResult> {
  const [profile, priority, insights, budget, facts] = await Promise.all([
    getProfile(),
    getFinancialPriority(),
    getVisibleInsights(),
    getBudgetSummary(),
    getCompanionUnlockFacts(),
  ]);
  const dict = getDictionary(await getLocale(profile?.preferred_language));
  const t = (key: string): string => lookup(dict, key) ?? key;
  const tips = dict.companions.tips;

  const tip = pickCompanionTip(companion.focus, {
    priorityType: priority?.priorityType ?? null,
    insightTypes: insights.map((i) => i.type as TipInsightType),
    pendingSubscriptionCount: facts.pendingSubscriptionCount,
    budgetStatus: budget ? budget.overall.status : null,
    emergencyFundMonthsProtected: facts.emergencyFundMonthsProtected,
    hasEmergencyFund: facts.emergencyFundMonthsProtected > 0,
  });

  let text: string;
  let href: string | null = null;
  switch (tip.kind) {
    case "priority": {
      const nba = buildNextBestActionText(priority!, t);
      text = nba.actionText;
      href = nba.cta ?? null;
      break;
    }
    case "insight": {
      const insight = insights[tip.index];
      text = tips.insights[tip.insightType]
        .replace("{category}", insight.categoryName ?? "")
        .replace("{goal}", insight.goalName ?? "")
        .replace("{percent}", String(Math.round(Math.abs(insight.percent ?? 0))))
        .replace("{amount}", formatMoney(Math.abs(insight.amountCents ?? 0)));
      href = "/ai";
      break;
    }
    case "subscriptions_pending":
      text = tips.subscriptionsPending.replace("{n}", String(tip.count));
      href = "/money/subscriptions";
      break;
    case "budget_over":
      text = tips.budgetOver;
      href = "/money/budget";
      break;
    case "budget_near_limit":
      text = tips.budgetNearLimit;
      href = "/money/budget";
      break;
    case "no_budget":
      text = tips.noBudget;
      href = "/money/budget";
      break;
    case "emergency_fund_progress":
      text = tips.emergencyFundProgress.replace("{months}", String(tip.months));
      href = "/plan/emergency-fund";
      break;
    case "all_good":
      text = tips.allGood;
      break;
  }

  return { companionId: companion.id, text, href, allGood: tip.kind === "all_good" };
}

function lookup(dict: unknown, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}
