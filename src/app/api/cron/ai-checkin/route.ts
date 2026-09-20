import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/config/env";
import { getPlanLimit } from "@/lib/billing/plans";
import { resolvePlanFromSubscription } from "@/lib/billing/entitlements";
import { buildMonthlyHealthCheckForUser } from "@/features/ai/lib/health-check-for-user";
import { buildCheckinSystemPrompt } from "@/features/ai/prompts/money-coach";
import { getAIProvider } from "@/features/ai/lib/provider";
import { createConversationAsAdmin, appendMessageAsAdmin } from "@/features/ai/actions";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { captureError } from "@/lib/observability";
import type { Subscription } from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 60;

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Timing-safe-ish comparison isn't critical here (this isn't a
 * cryptographic secret comparison against attacker-controlled timing in a
 * hot path), but a plain `===` is fine for a cron shared-secret check —
 * matches the header Vercel Cron sends when CRON_SECRET is configured on
 * the project (`Authorization: Bearer <secret>`).
 */
function isAuthorized(request: Request): boolean {
  const secret = getServerEnv().CRON_SECRET;
  if (!secret) return false; // unconfigured must never mean "skip the check" — see env.ts's own doc comment
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Proactive Pro-only AI Money Coach check-in (FEATURES/PlanLimits.
 * aiCheckinsPerMonth — see billing/plans.ts). Runs once a month (see
 * vercel.json) — the app's first server-initiated (not user-triggered) AI
 * call, so cost is deliberately bounded to (Pro subscriber count × 1 short
 * generate() call per month), not by anything a user does. Cannot fire for
 * real until this app is actually deployed to Vercel (no deployment exists
 * yet) — verify locally by invoking this route directly with the correct
 * Authorization header.
 */
// Vercel Cron always sends a GET request to the configured path (see
// vercel.json) — not POST/PUT — with `Authorization: Bearer $CRON_SECRET`
// automatically attached when that env var is set on the project.
export async function GET(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const provider = getAIProvider();
  if (!provider) return Response.json({ error: "AI not configured" }, { status: 200 });

  const admin = createAdminClient();
  const monthKey = currentMonthKey();
  const dedupeKey = `ai_checkin:${monthKey}`;

  const { data: subscriptions, error: subsError } = await admin
    .from("subscriptions")
    .select("*")
    .in("plan", ["plus", "pro"])
    .in("status", ["trialing", "active", "past_due"]);
  if (subsError) {
    captureError(new Error(subsError.message), { route: "cron/ai-checkin", operation: "load_subscriptions" });
    return Response.json({ error: "Failed to load subscriptions" }, { status: 500 });
  }

  // Re-resolve through the same pure rule getUserPlan() uses rather than
  // trusting the raw `plan` column — a status that doesn't actually grant
  // entitlement (e.g. a stale "pro" row with a canceled/incomplete status)
  // must fall back to "free" here exactly like everywhere else.
  const proUserIds = (subscriptions ?? [])
    .filter((row) => resolvePlanFromSubscription(row as Subscription) === "pro")
    .map((row) => row.user_id as string);

  if (proUserIds.length === 0 || (getPlanLimit("pro", "aiCheckinsPerMonth") ?? 0) <= 0) {
    return Response.json({ processed: 0, skipped: 0, failed: 0 });
  }

  const [{ data: alreadySent }, { data: preferences }, { data: profiles }] = await Promise.all([
    admin.from("financial_notifications").select("user_id").in("user_id", proUserIds).eq("dedupe_key", dedupeKey),
    admin.from("notification_preferences").select("user_id, ai_checkin").in("user_id", proUserIds),
    admin.from("profiles").select("user_id, preferred_language").in("user_id", proUserIds),
  ]);

  const alreadySentIds = new Set((alreadySent ?? []).map((r) => r.user_id as string));
  const optedOutIds = new Set((preferences ?? []).filter((p) => p.ai_checkin === false).map((p) => p.user_id as string));
  const localeByUserId = new Map((profiles ?? []).map((p) => [p.user_id as string, p.preferred_language as string]));

  const eligibleUserIds = proUserIds.filter((id) => !alreadySentIds.has(id) && !optedOutIds.has(id));

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  // Sequential, not Promise.all — a batch job with N users each doing
  // several queries plus a Claude call is exactly the kind of fan-out that
  // could exceed this route's own 60s budget once N is nontrivial. Known
  // v1 limitation (see the proactive-check-in plan): add cursor/offset
  // pagination once real subscriber counts justify it, not before.
  for (const userId of eligibleUserIds) {
    try {
      const health = await buildMonthlyHealthCheckForUser(admin, userId);

      if (!health.hasEnoughData) {
        // Not ready for a comparison yet — skip WITHOUT writing the
        // notification, so the dedupe key isn't burned and a retry next
        // month (once they have a prior month to compare against) can
        // still succeed instead of being permanently skipped for this
        // period.
        skipped++;
        continue;
      }

      const locale = await getLocale(localeByUserId.get(userId));
      const dict = getDictionary(locale);
      const system = buildCheckinSystemPrompt(health, locale);

      const result = await provider.generate({
        system,
        messages: [{ role: "user", content: "Generate the monthly check-in message now." }],
        maxTokens: 400,
      });

      const conversationId = await createConversationAsAdmin(admin, userId, dict.notifications.categories.ai_checkin);
      await appendMessageAsAdmin(admin, userId, conversationId, "assistant", result.content);

      // Inserted last, deliberately — see this route's own doc comment:
      // a failed generate()/appendMessage() above must never burn the
      // dedupe key, so a retry stays possible.
      const { error: notifyError } = await admin.from("financial_notifications").insert({
        user_id: userId,
        type: "ai_checkin",
        title: dict.notifications.categories.ai_checkin,
        body: result.content.slice(0, 140),
        dedupe_key: dedupeKey,
      });
      if (notifyError) throw new Error(notifyError.message);

      processed++;
    } catch (error) {
      failed++;
      captureError(error, { route: "cron/ai-checkin", operation: "process_user", userId });
    }
  }

  return Response.json({ processed, skipped, failed });
}
