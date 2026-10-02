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

/** Which quota an AI call spends (migration 0037). */
export type AIUsageFeature = "chat" | "capture";

/** Postgres/PostgREST "column not there yet" — migration 0037 not applied on this database. */
function isMissingFeatureColumn(error: { code?: string } | null): boolean {
  return error?.code === "42703" || error?.code === "PGRST204";
}

/**
 * Live count of the signed-in user's AI calls for one feature so far in the
 * current calendar-month billing period. Deliberately a live COUNT against
 * Day 4's `ai_usage_log` rather than a maintained counter table — see
 * migration 0008's header for why a second ledger/counter would risk
 * drifting from the real log. Before migration 0037 there is no `feature`
 * column, so every row counts (the old, shared quota) — never a crash.
 */
async function countAIUsageThisPeriod(userId: string, feature: AIUsageFeature): Promise<number> {
  const supabase = await createClient();
  const { start, end } = getCurrentBillingPeriod();
  const base = () =>
    supabase
      .from("ai_usage_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString());

  let { count, error } = await base().eq("feature", feature);
  if (isMissingFeatureColumn(error)) ({ count, error } = await base());
  if (error) return 0;
  return count ?? 0;
}

/**
 * Records one AI call against a feature's quota. Falls back to the
 * pre-0037 row shape if the column doesn't exist yet, so logging (and the
 * quota it feeds) never silently stops.
 */
export async function recordAIUsage(input: {
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  feature: AIUsageFeature;
}): Promise<void> {
  const supabase = await createClient();
  const row = { user_id: input.userId, model: input.model, input_tokens: input.inputTokens, output_tokens: input.outputTokens };
  const { error } = await supabase.from("ai_usage_log").insert({ ...row, feature: input.feature });
  if (isMissingFeatureColumn(error)) await supabase.from("ai_usage_log").insert(row);
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
  const [used, entitlements] = await Promise.all([countAIUsageThisPeriod(userId, "chat"), getEntitlements()]);
  return computeUsageStatus(used, entitlements.limits.aiMessagesPerMonth, getNextResetDateString());
}

/**
 * Quick Capture's AI helpers (slip scan, sentence reading, recap
 * categories) have their own monthly cap — they never use up the user's
 * AI Money Coach messages, but are still bounded for cost.
 */
export async function getCaptureAIUsageStatus(userId: string): Promise<AIUsageStatus> {
  const [used, entitlements] = await Promise.all([countAIUsageThisPeriod(userId, "capture"), getEntitlements()]);
  return computeUsageStatus(used, entitlements.limits.aiCaptureAssistsPerMonth, getNextResetDateString());
}
