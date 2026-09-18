import "server-only";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Account } from "@/types/database";

/**
 * Wrapped in React's `cache()` (audit finding, mirrors `getProfile()`'s
 * existing rationale): a single dashboard render independently calls this
 * with no arguments from `getDashboardData()`, `getNetWorthBreakdown()`, and
 * `getSafeToSpend()` — `cache()` dedupes calls with identical arguments
 * within one request's render pass, so those collapse into one query.
 */
export const getAccounts = cache(async (options?: { includeArchived?: boolean }): Promise<Account[]> => {
  const supabase = await createClient();
  let query = supabase
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: true });

  if (!options?.includeArchived) {
    query = query.eq("is_archived", false);
  }

  const { data, error } = await query;
  if (error) throw new Error("Failed to load accounts");
  return data ?? [];
});

export async function getAccount(id: string): Promise<Account | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error("Failed to load account");
  return data;
}
