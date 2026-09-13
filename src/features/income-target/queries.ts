import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { IncomeTarget } from "@/types/database";

/** One row per user — the current live target, no versioning. */
export async function getIncomeTarget(): Promise<IncomeTarget | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("income_targets").select("*").maybeSingle();
  if (error) throw new Error("Failed to load income target");
  return data;
}
