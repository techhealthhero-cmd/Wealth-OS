"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getWealthMissionInputs } from "@/features/engagement/queries";
import { awardXpOnce } from "@/features/engagement/xp";
import { generateWealthMissionCandidates, isMissionAutoCompletable } from "@/lib/financial/wealth-missions";
import { NOTIFICATION_CATEGORIES } from "@/lib/notification-categories";
import type { MissionStatus } from "@/types/database";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

/**
 * Regenerates the user's Wealth Missions from live data: inserts any newly
 * applicable template that isn't already active, refreshes progress on
 * existing ones, and auto-completes (+ awards XP for) any that have reached
 * their real, measured target. Never marks a mission complete from an
 * AI-generated claim — only from `isMissionAutoCompletable()` against real
 * `progressQuantity`/`targetQuantity` numbers.
 *
 * Deliberately does **not** call `revalidatePath()` — Next.js disallows that
 * during a Server Component's render, and this function is called directly
 * from `WealthMissionList`'s render (not from a client-triggered form
 * submission) so the freshly-synced data is already what gets rendered in
 * this same request; there is nothing stale left to revalidate. The
 * `syncWealthMissions` action below is the version to call from any future
 * client-triggered interaction that needs the revalidation.
 */
export async function syncWealthMissionsData(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const inputs = await getWealthMissionInputs();
  const candidates = generateWealthMissionCandidates(inputs);

  const { data: existingMissions, error: fetchError } = await supabase
    .from("wealth_missions")
    .select("id, title, status, target_quantity, progress_quantity")
    .eq("user_id", user.id);
  if (fetchError) return { error: "Failed to sync missions" };

  const activeByTemplateKey = new Map((existingMissions ?? []).filter((m) => m.status !== "completed" && m.status !== "skipped").map((m) => [m.title, m]));

  for (const candidate of candidates) {
    const existing = activeByTemplateKey.get(candidate.templateKey);

    if (!existing) {
      const autoCompleted = isMissionAutoCompletable(candidate);
      const { data: inserted, error: insertError } = await supabase
        .from("wealth_missions")
        .insert({
          user_id: user.id,
          title: candidate.templateKey,
          mission_type: candidate.missionType,
          related_domain: candidate.relatedDomain,
          target_quantity: candidate.targetQuantity,
          progress_quantity: candidate.progressQuantity,
          status: autoCompleted ? "completed" : "not_started",
          impact_level: candidate.impactLevel,
          completed_at: autoCompleted ? new Date().toISOString() : null,
        })
        .select("id")
        .single();
      if (!insertError && inserted && autoCompleted) {
        await awardXpOnce(user.id, "mission_completed", inserted.id);
      }
      continue;
    }

    const autoCompleted = isMissionAutoCompletable(candidate);
    const nextStatus: MissionStatus = autoCompleted ? "completed" : existing.status === "not_started" && candidate.progressQuantity > 0 ? "in_progress" : (existing.status as MissionStatus);

    await supabase
      .from("wealth_missions")
      .update({
        progress_quantity: candidate.progressQuantity,
        status: nextStatus,
        completed_at: autoCompleted ? new Date().toISOString() : null,
      })
      .eq("id", existing.id)
      .eq("user_id", user.id);

    if (autoCompleted && existing.status !== "completed") {
      await awardXpOnce(user.id, "mission_completed", existing.id);
    }
  }

  return { success: true };
}

/** Client-callable Server Action variant — runs the same sync then revalidates. Use `syncWealthMissionsData()` instead when calling from a Server Component's render. */
export async function syncWealthMissions(): Promise<ActionResult> {
  const result = await syncWealthMissionsData();
  revalidatePath("/missions");
  revalidatePath("/dashboard");
  return result;
}

export async function updateWealthMissionStatus(missionId: string, status: MissionStatus): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase
    .from("wealth_missions")
    .update({ status, completed_at: status === "completed" ? new Date().toISOString() : null })
    .eq("id", missionId)
    .eq("user_id", user.id);
  if (error) return { error: "Failed to update mission" };

  if (status === "completed") {
    await awardXpOnce(user.id, "mission_completed", missionId);
  }

  revalidatePath("/missions");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function markNotificationRead(notificationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase
    .from("financial_notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", user.id);
  if (error) return { error: "Failed to update notification" };

  revalidatePath("/notifications");
  return { success: true };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase.from("financial_notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
  if (error) return { error: "Failed to update notifications" };

  revalidatePath("/notifications");
  return { success: true };
}

export async function updateNotificationPreferences(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const values = Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c, formData.get(c) === "on"]));

  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ ...values, user_id: user.id }, { onConflict: "user_id" });
  if (error) return { error: "Failed to save notification preferences" };

  revalidatePath("/notifications");
  return { success: true };
}
