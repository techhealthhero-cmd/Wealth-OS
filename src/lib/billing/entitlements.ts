import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  FEATURES,
  PLANS,
  getPlanLimit,
  planHasFeature,
  statusGrantsEntitlement,
  type FeatureId,
  type PlanDefinition,
  type PlanId,
  type PlanLimits,
} from "@/lib/billing/plans";
import type { Subscription } from "@/types/database";

export { FEATURES };
export type { FeatureId, PlanId };

/**
 * The trusted server-side entitlement resolver (Day 7 STEP 4/5). Every
 * premium-feature check in this app — page-level, action-level, API-route-
 * level — goes through one of the functions in this file, never a direct
 * read of `subscriptions.plan` and never a client-supplied plan value.
 *
 * Resolution chain: billing provider -> webhook (service-role write) ->
 * `subscriptions` table -> this resolver -> caller. If the row's `status`
 * doesn't actually grant entitlement (canceled/incomplete/a stale "free"
 * row with a leftover paid `plan` value from before a downgrade), the
 * resolved plan falls back to "free" regardless of the `plan` column — the
 * server's read of provider-confirmed state always wins over anything else.
 */
async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function getSubscriptionRow(userId: string): Promise<Subscription | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("subscriptions").select("*").eq("user_id", userId).maybeSingle();
  return (data as Subscription | null) ?? null;
}

/**
 * Pure resolution rule, deliberately separated from the DB fetch above so
 * it's directly unit-testable (same "pure core, thin DB wrapper" pattern as
 * `src/lib/financial/*.ts`) without mocking Supabase/`next/headers`. No row,
 * or a non-entitling status (canceled/incomplete/free), both resolve to
 * "free" — there is no path by which the absence of confirmed paid state
 * yields anything but Free.
 */
export function resolvePlanFromSubscription(row: Subscription | null): PlanId {
  if (!row) return "free";
  if (!statusGrantsEntitlement(row.status)) return "free";
  return row.plan;
}

/** Resolves the signed-in user's actual entitled plan (or "free" if signed out). */
export async function getUserPlan(): Promise<PlanId> {
  const userId = await getCurrentUserId();
  if (!userId) return "free";

  const row = await getSubscriptionRow(userId);
  return resolvePlanFromSubscription(row);
}

export interface Entitlements {
  plan: PlanId;
  definition: PlanDefinition;
  features: Record<FeatureId, boolean>;
  limits: PlanLimits;
}

/** The full resolved entitlement set for the signed-in user — plan + every feature flag + every limit, in one call. */
export async function getEntitlements(): Promise<Entitlements> {
  const plan = await getUserPlan();
  const definition = PLANS[plan];
  return { plan, definition, features: definition.features, limits: definition.limits };
}

/** Whether the signed-in user's current plan includes `feature`. Client-side hiding alone is never sufficient — this (or `requireFeature`) must gate the actual data path too. */
export async function canUseFeature(feature: FeatureId): Promise<boolean> {
  const plan = await getUserPlan();
  return planHasFeature(plan, feature);
}

export type RequireFeatureResult = { allowed: true; plan: PlanId } | { allowed: false; plan: PlanId };

/**
 * The mandatory server-side gate for a premium action/route. Never throws —
 * callers decide how to surface a denial (a localized error message, a
 * locked UI state, a 403 JSON response), but every one of them MUST check
 * `.allowed` before performing the gated operation.
 */
export async function requireFeature(feature: FeatureId): Promise<RequireFeatureResult> {
  const plan = await getUserPlan();
  return { allowed: planHasFeature(plan, feature), plan };
}

/** A numeric plan limit for the signed-in user (e.g. active goals allowed). `null` = unlimited. */
export async function getFeatureLimit(limit: keyof PlanLimits): Promise<number | null> {
  const plan = await getUserPlan();
  return getPlanLimit(plan, limit);
}
