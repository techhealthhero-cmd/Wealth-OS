"use server";

import { revalidatePath } from "next/cache";

import { createClient, getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEntitlements } from "@/lib/billing/entitlements";
import { getProfile } from "@/features/profile/queries";
import { getFinancialPriority } from "@/features/ai/tools";
import { getVisibleInsights } from "@/features/ai/lib/insights";
import { buildNextBestActionText } from "@/features/ai/lib/next-best-action";
import { getBudgetSummary } from "@/features/budget/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { formatMoney } from "@/lib/financial/money";
import { getCompanion } from "@/lib/companions/catalog";
import { findNewlyEarnedCompanionIds, isCompanionAvailable } from "@/lib/companions/unlock";
import { pickCompanionTip, type TipInsightType } from "@/lib/companions/tips";
import {
  getCompanionState,
  getCompanionUnlockFacts,
  getUnlockedCompanionIds,
  isCompanionSchemaMissing,
} from "./queries";

/**
 * Checks the signed-in user's real data against every spirit's unlock rule
 * and permanently records any newly earned ones. Returns the ids unlocked
 * by THIS call (so the client celebrates each exactly once).
 *
 * Written with the service-role client on purpose: `user_companions` has
 * no insert policy (migration 0038) so a client can't grant itself a
 * spirit through the REST API. The only id ever written is the
 * authenticated user's own, and only for rules this server just verified.
 */
export async function syncCompanionUnlocks(): Promise<string[]> {
  const user = await getAuthUser();
  if (!user) return [];

  const [facts, unlocked] = await Promise.all([getCompanionUnlockFacts(), getUnlockedCompanionIds()]);
  const newlyEarned = findNewlyEarnedCompanionIds(facts, new Set(unlocked));
  if (newlyEarned.length === 0) return [];

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_companions")
    .upsert(
      newlyEarned.map((companionId) => ({ user_id: user.id, companion_id: companionId })),
      { onConflict: "user_id,companion_id", ignoreDuplicates: true }
    );
  if (error) {
    // Migration 0038 not applied yet — nothing to celebrate, no error to show.
    if (!isCompanionSchemaMissing(error.code)) console.error("[companions] failed to record unlocks:", error.code);
    return [];
  }
  revalidatePath("/", "layout");
  return newlyEarned;
}

export type SelectCompanionResult = { success: true } | { success: false; error: string };

export async function selectCompanion(companionId: string): Promise<SelectCompanionResult> {
  const user = await getAuthUser();
  const profile = await getProfile();
  const dict = getDictionary(await getLocale(profile?.preferred_language));
  if (!user) return { success: false, error: dict.companions.errors.signedOut };

  const companion = getCompanion(companionId);
  const [entitlements, unlocked] = await Promise.all([getEntitlements(), getUnlockedCompanionIds()]);
  if (!companion || !isCompanionAvailable(companion, new Set(unlocked), entitlements.features)) {
    return { success: false, error: dict.companions.errors.locked };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ selected_companion_id: companion.id })
    .eq("user_id", user.id);
  if (error) {
    return {
      success: false,
      error: isCompanionSchemaMissing(error.code) ? dict.companions.errors.notReady : dict.companions.errors.saveFailed,
    };
  }
  revalidatePath("/", "layout");
  return { success: true };
}

export interface CompanionTipResult {
  companionId: string;
  text: string;
  href: string | null;
}

/**
 * The active companion's speech-bubble tip, built only from deterministic
 * data the app already computes. Plus/Pro only (COMPANION_PRESENCE) —
 * enforced here, not just by hiding the bubble on the client.
 */
export async function getCompanionTip(): Promise<CompanionTipResult | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const state = await getCompanionState();
  if (!state.presence) return null;

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

  const tip = pickCompanionTip(state.active.focus, {
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

  return { companionId: state.active.id, text, href };
}

function lookup(dict: unknown, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}
