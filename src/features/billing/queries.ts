import "server-only";

import { getAuthUser } from "@/lib/supabase/server";
import { getSubscriptionRow } from "@/lib/billing/entitlements";
import type { Subscription } from "@/types/database";

/**
 * The signed-in user's own subscription row, or null (no row = Free, same
 * convention as `getUserPlan()`). Perf audit finding: this used to run its
 * own independent auth check + `subscriptions` query, duplicating exactly
 * what `getUserPlan()`/`getEntitlements()` already does on the same page
 * (e.g. `/billing` calls both) — now shares the same cached auth user and
 * the same cached row lookup instead of re-fetching both.
 */
export async function getSubscription(): Promise<Subscription | null> {
  const user = await getAuthUser();
  if (!user) return null;
  return getSubscriptionRow(user.id);
}
