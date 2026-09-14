import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/billing/entitlements";
import { getCurrentBillingPeriod, getNextResetDateString } from "@/lib/billing/period";

export interface AIUsageStatus {
  used: number;
  /** null = unlimited (no plan currently has this, but the type stays honest). */
  limit: number | null;
  remaining: number | null;
  limitReached: boolean;
  resetDate: string;
}

/**
 * Live count of the signed-in user's AI Money Coach messages so far in the
 * current calendar-month billing period. Deliberately a live COUNT against
 * Day 4's `ai_usage_log` rather than a maintained counter table — see
 * migration 0008's header for why a second ledger/counter would risk
 * drifting from the real log.
 */
async function countAIUsageThisPeriod(userId: string): Promise<number> {
  const supabase = await createClient();
  const { start, end } = getCurrentBillingPeriod();

  const { count, error } = await supabase
    .from("ai_usage_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());

  if (error) return 0;
  return count ?? 0;
}

/**
 * Pure computation, separated from the DB/plan lookups above so it's
 * directly unit-testable at the exact under/at/over-limit boundaries STEP
 * 17 requires, without mocking Supabase.
 */
export function computeUsageStatus(used: number, limit: number, resetDate: string): AIUsageStatus {
  const remaining = Math.max(0, limit - used);
  return { used, limit, remaining, limitReached: used >= limit, resetDate };
}

/**
 * Full usage status for the AI Chat feature: how many messages used, the
 * plan's limit, how many remain, and whether the limit is already reached.
 * Used both by the pre-request gate in /api/ai/chat and by the usage
 * indicator UI (Day 7 STEP 10) so both read the exact same numbers.
 */
export async function getAIUsageStatus(userId: string): Promise<AIUsageStatus> {
  const [used, entitlements] = await Promise.all([countAIUsageThisPeriod(userId), getEntitlements()]);
  return computeUsageStatus(used, entitlements.limits.aiMessagesPerMonth, getNextResetDateString());
}
