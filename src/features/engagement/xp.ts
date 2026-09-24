import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getXpReward } from "@/lib/financial/xp";

/**
 * Awards XP for an event exactly once per `related_id` — the actual
 * dedupe guarantee some callers (mission auto-completion) depend on to
 * never double-count the same real-world action.
 *
 * Deliberately NOT in a `"use server"` file: every exported async function
 * in a `"use server"` module becomes a client-callable Server Action, and
 * this function trusts its `userId` parameter completely with no
 * independent auth/ownership check of its own — every real caller already
 * verifies `supabase.auth.getUser()` and passes that user's own id before
 * calling this, so the actual defense-in-depth check belongs there, not
 * here. Keeping this in a plain `server-only` module (importable from other
 * server-side action files, same as before) rather than a `"use server"`
 * one removes the otherwise-unenforced public entry point entirely,
 * without changing behavior for any legitimate caller.
 *
 * Returns whether XP was actually awarded (`false` on the dedupe no-op) —
 * callers that also fire a `mission_completed` analytics event use this to
 * avoid over-firing it on a redundant re-completion call (e.g. a double
 * click, or an idempotent retry), same "once per real occurrence" guarantee
 * this function already gives XP itself.
 */
export async function awardXpOnce(
  userId: string,
  eventType: Parameters<typeof getXpReward>[0],
  relatedId: string | null
): Promise<boolean> {
  const supabase = await createClient();

  if (relatedId) {
    const { data: existing } = await supabase
      .from("xp_events")
      .select("id")
      .eq("user_id", userId)
      .eq("event_type", eventType)
      .eq("related_id", relatedId)
      .maybeSingle();
    if (existing) return false;
  }

  await supabase.from("xp_events").insert({
    user_id: userId,
    event_type: eventType,
    xp_amount: getXpReward(eventType),
    related_id: relatedId,
  });
  return true;
}
