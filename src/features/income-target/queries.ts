import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { IncomeTarget } from "@/types/database";
import { throwDbError } from "@/lib/db-error";

/** One row per user — the current live target, no versioning. */
export async function getIncomeTarget(): Promise<IncomeTarget | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("income_targets").select("*").maybeSingle();
  if (error) throwDbError(error, "income-target.getIncomeTarget", "Failed to load income target");
  return data;
}
