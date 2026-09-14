import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Subscription } from "@/types/database";

/** The signed-in user's own subscription row, or null (no row = Free, same convention as `getUserPlan()`). */
export async function getSubscription(): Promise<Subscription | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
  return (data as Subscription | null) ?? null;
}
