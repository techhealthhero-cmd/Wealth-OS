/**
 * Deterministic companion availability rules. Pure functions only — the DB
 * reads that produce `CompanionUnlockFacts` live in
 * src/features/companions/queries.ts, and every rule here is measured
 * relative to the user's own situation (months of their own expenses, their
 * own budget), never an absolute baht amount: a fixed "฿100,000" threshold
 * would lock lower-income users out no matter how well they manage money.
 */
import type { FeatureId } from "@/lib/billing/plans";
import {
  COMPANIONS,
  getCompanion,
  getStarterCompanion,
  type CompanionDefinition,
  type UnlockRuleId,
} from "./catalog";

export interface CompanionUnlockFacts {
  /** The last fully finished month's budget totals, or null if that month had no budget. */
  lastMonthBudget: { budgetCents: number; spentCents: number } | null;
  emergencyFundMonthsProtected: number;
  /** Detected subscriptions the user has decided on (confirmed / dismissed / cancelled). */
  reviewedSubscriptionCount: number;
  /** Detected subscriptions still waiting for a decision. */
  pendingSubscriptionCount: number;
  /** `debt_payment` transactions in the last 30 days. */
  recentDebtPaymentCount: number;
}

export interface UnlockProgress {
  current: number;
  target: number;
}

export function isUnlockRuleMet(rule: UnlockRuleId, facts: CompanionUnlockFacts): boolean {
  switch (rule) {
    case "budget_month_kept":
      return (
        facts.lastMonthBudget !== null &&
        facts.lastMonthBudget.budgetCents > 0 &&
        facts.lastMonthBudget.spentCents <= facts.lastMonthBudget.budgetCents
      );
    case "emergency_fund_one_month":
      return facts.emergencyFundMonthsProtected >= 1;
    case "money_leaks_handled":
      return (
        (facts.reviewedSubscriptionCount >= 1 && facts.pendingSubscriptionCount === 0) ||
        facts.recentDebtPaymentCount >= 1
      );
  }
}

/** How close the user is, for the locked card's progress bar. Always clamps to [0, target]. */
export function getUnlockProgress(rule: UnlockRuleId, facts: CompanionUnlockFacts): UnlockProgress {
  if (rule === "emergency_fund_one_month") {
    const months = Math.max(0, Math.min(1, facts.emergencyFundMonthsProtected));
    return { current: Math.round(months * 100) / 100, target: 1 };
  }
  return { current: isUnlockRuleMet(rule, facts) ? 1 : 0, target: 1 };
}

/** Progress-earned companions whose rule is met now but aren't stored as unlocked yet. */
export function findNewlyEarnedCompanionIds(facts: CompanionUnlockFacts, alreadyUnlocked: ReadonlySet<string>): string[] {
  return COMPANIONS.filter(
    (c) => c.access.type === "progress" && !alreadyUnlocked.has(c.id) && isUnlockRuleMet(c.access.rule, facts)
  ).map((c) => c.id);
}

export function isCompanionAvailable(
  companion: CompanionDefinition,
  unlockedIds: ReadonlySet<string>,
  features: Record<FeatureId, boolean>
): boolean {
  switch (companion.access.type) {
    case "starter":
      return true;
    case "progress":
      return unlockedIds.has(companion.id);
    case "plan":
      return features[companion.access.feature] === true;
  }
}

/**
 * The companion actually shown. The stored selection is only a preference —
 * if it names an unknown companion, a not-yet-earned spirit, or a wizard
 * from a plan the user no longer has, the starter is used instead.
 */
export function resolveActiveCompanion(
  selectedId: string | null | undefined,
  unlockedIds: ReadonlySet<string>,
  features: Record<FeatureId, boolean>
): CompanionDefinition {
  const selected = getCompanion(selectedId);
  if (selected && isCompanionAvailable(selected, unlockedIds, features)) return selected;
  return getStarterCompanion();
}
