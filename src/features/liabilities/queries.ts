import "server-only";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Liability } from "@/types/database";

/**
 * Wrapped in React's `cache()` (perf audit finding): called independently
 * (directly, and via `getNetWorthBreakdown()` x3 and `getSafeToSpend()`)
 * up to ~5x on a single dashboard render — dedupes to one query per request.
 */
export const getLiabilities = cache(async (): Promise<Liability[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("liabilities")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw new Error("Failed to load liabilities");
  return data ?? [];
});

export async function getLiability(id: string): Promise<Liability | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("liabilities").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Failed to load liability");
  return data;
}
