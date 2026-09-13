import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { IncomeSource } from "@/types/database";

export async function getIncomeSources(): Promise<IncomeSource[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("income_sources")
    .select("*")
    .order("expected_monthly_income", { ascending: false });
  if (error) throw new Error("Failed to load income sources");
  return data ?? [];
}

export async function getIncomeSource(id: string): Promise<IncomeSource | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("income_sources").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Failed to load income source");
  return data;
}
