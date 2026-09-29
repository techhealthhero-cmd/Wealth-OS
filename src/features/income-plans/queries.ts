import "server-only";

import { createClient } from "@/lib/supabase/server";
import { throwDbError } from "@/lib/db-error";
import type { IncomePlan } from "@/types/database";

export async function getIncomePlans(): Promise<IncomePlan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("income_plans")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throwDbError(error, "income-plans.getIncomePlans", "Failed to load income plans");
  return data ?? [];
}
