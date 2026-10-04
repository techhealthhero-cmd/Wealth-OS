"use server";

import { revalidatePath } from "next/cache";

import { createClient, getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEntitlements } from "@/lib/billing/entitlements";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { getCompanion } from "@/lib/companions/catalog";
import { findNewlyEarnedCompanionIds, isCompanionAvailable } from "@/lib/companions/unlock";
import {
  getCompanionState,
  getCompanionUnlockFacts,
  getUnlockedCompanionIds,
  isCompanionSchemaMissing,
} from "./queries";
import { buildCompanionTip, type CompanionTipResult } from "./tip-builder";

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

/**
 * The active companion's proactive speech-bubble tip. Plus/Pro only
 * (COMPANION_PRESENCE) — enforced here, not just by hiding the bubble on
 * the client. The text itself comes from `buildCompanionTip`.
 */
export async function getCompanionTip(): Promise<CompanionTipResult | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const state = await getCompanionState();
  if (!state.presence) return null;
  return buildCompanionTip(state.active);
}
