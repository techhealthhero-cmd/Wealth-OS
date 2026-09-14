"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/db-error";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { getProfile } from "@/features/profile/queries";
import type { SubscriptionStatus } from "@/types/database";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

async function getRequestDictionary() {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  return getDictionary(locale);
}

async function setSubscriptionStatus(id: string, status: SubscriptionStatus): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase.from("detected_subscriptions").update({ status }).eq("id", id).eq("user_id", user.id);
  if (error) return { error: friendlyDbError(error, "setSubscriptionStatus", dict.subscriptions.saveFailed) };

  revalidatePath("/money/subscriptions");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function confirmSubscription(id: string): Promise<ActionResult> {
  return setSubscriptionStatus(id, "confirmed");
}

export async function dismissSubscription(id: string): Promise<ActionResult> {
  return setSubscriptionStatus(id, "dismissed");
}

export async function markSubscriptionCancelled(id: string): Promise<ActionResult> {
  return setSubscriptionStatus(id, "cancelled");
}
