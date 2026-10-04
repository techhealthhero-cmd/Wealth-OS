import "server-only";
import { cache } from "react";

import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { getEntitlements } from "@/lib/billing/entitlements";
import { getBudgetSummary } from "@/features/budget/queries";
import { getEmergencyFund, getEssentialMonthlyExpenses } from "@/features/emergency-fund/queries";
import { getTransactions } from "@/features/transactions/queries";
import { calculateMonthsProtected } from "@/lib/financial/emergency-fund";
import { parseMoneyToCents } from "@/lib/financial/money";
import { toLocalDateString } from "@/lib/date";
import { resolveActiveCompanion } from "@/lib/companions/unlock";
import type { CompanionDefinition } from "@/lib/companions/catalog";
import type { CompanionUnlockFacts } from "@/lib/companions/unlock";
import type { FeatureId } from "@/lib/billing/plans";

/**
 * "Table/column doesn't exist" — migration 0038 not applied to this database
 * yet. Postgres reports 42P01/42703; PostgREST's schema cache reports
 * PGRST205/PGRST204 before the query even reaches Postgres.
 */
export function isCompanionSchemaMissing(code: string | undefined): boolean {
  return code === "42P01" || code === "42703" || code === "PGRST205" || code === "PGRST204";
}

export interface CompanionState {
  active: CompanionDefinition;
  unlockedIds: string[];
  features: Record<FeatureId, boolean>;
  /** Plus/Pro: animation, reactions and proactive tips. */
  presence: boolean;
}

/**
 * Earned (stored) spirit ids for the signed-in user. Returns [] — never
 * throws — when migration 0038 isn't applied yet, so the app keeps working
 * with just the starter companion.
 */
export const getUnlockedCompanionIds = cache(async (): Promise<string[]> => {
  const user = await getAuthUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("user_companions").select("companion_id").eq("user_id", user.id);
  if (error) {
    if (!isCompanionSchemaMissing(error.code)) console.error("[companions] failed to load unlocks:", error.code);
    return [];
  }
  return (data ?? []).map((row: { companion_id: string }) => row.companion_id);
});

/**
 * Cheap enough for the app layout (every page): the profile and plan are
 * already `cache()`d per request by the header, so this adds one small
 * `user_companions` query.
 */
export const getCompanionState = cache(async (): Promise<CompanionState> => {
  const [profile, entitlements, unlockedIds] = await Promise.all([
    getProfile(),
    getEntitlements(),
    getUnlockedCompanionIds(),
  ]);
  const active = resolveActiveCompanion(profile?.selected_companion_id ?? null, new Set(unlockedIds), entitlements.features);
  return {
    active,
    unlockedIds,
    features: entitlements.features,
    presence: entitlements.features.COMPANION_PRESENCE,
  };
});

/** The real, deterministic inputs the unlock rules need — nothing estimated or AI-derived. */
export async function getCompanionUnlockFacts(): Promise<CompanionUnlockFacts> {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const supabase = await createClient();
  const [lastMonthBudget, emergencyFund, essential, debtPayments, subscriptions] = await Promise.all([
    getBudgetSummary(lastMonth),
    getEmergencyFund(),
    getEssentialMonthlyExpenses(),
    getTransactions({ from: toLocalDateString(thirtyDaysAgo), to: toLocalDateString(now), type: "debt_payment" }),
    supabase.from("detected_subscriptions").select("status"),
  ]);

  const statuses: string[] = (subscriptions.data ?? []).map((row: { status: string }) => row.status);
  const emergencyFundCents = emergencyFund ? parseMoneyToCents(emergencyFund.current_amount) : 0;

  return {
    lastMonthBudget: lastMonthBudget
      ? { budgetCents: lastMonthBudget.overall.budgetCents, spentCents: lastMonthBudget.overall.spentCents }
      : null,
    emergencyFundMonthsProtected: calculateMonthsProtected(emergencyFundCents, essential.cents),
    reviewedSubscriptionCount: statuses.filter((s) => s !== "pending").length,
    pendingSubscriptionCount: statuses.filter((s) => s === "pending").length,
    recentDebtPaymentCount: debtPayments.length,
  };
}
