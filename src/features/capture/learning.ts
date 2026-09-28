import "server-only";

import { createClient } from "@/lib/supabase/server";
import { normalizeMerchant } from "@/lib/capture/transaction-parser";

/**
 * Remembers "this merchant → this category" for the SIGNED-IN user.
 *
 * Deliberately NOT in a "use server" file: it takes a userId argument, and
 * anything exported from a server-actions module is callable from the
 * browser. Callers (server actions) always pass the session user's id; RLS
 * additionally enforces user_id = auth.uid() on every write.
 *
 * Best-effort: any failure — including the table not existing before
 * migration 0021 — is swallowed, so learning never fails the save that
 * triggered it.
 */
export async function learnMerchantCategory(userId: string, merchantText: string | null, categoryId: string | null) {
  if (!merchantText || !categoryId) return;
  const key = normalizeMerchant(merchantText);
  if (key.length < 2) return;
  try {
    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("merchant_category_preferences")
      .select("id, usage_count")
      .eq("user_id", userId)
      .eq("merchant_normalized", key)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("merchant_category_preferences")
        .update({ category_id: categoryId, usage_count: existing.usage_count + 1 })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("merchant_category_preferences")
        .insert({ user_id: userId, merchant_normalized: key, category_id: categoryId });
    }
  } catch {
    // Learning is an enhancement, never a blocker.
  }
}
