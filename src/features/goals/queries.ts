import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { FinancialGoal } from "@/types/database";

const PRIORITY_RANK: Record<FinancialGoal["priority"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function getGoals(options?: { includeArchived?: boolean }): Promise<FinancialGoal[]> {
  const supabase = await createClient();
  let query = supabase.from("financial_goals").select("*").order("created_at", { ascending: true });

  if (!options?.includeArchived) {
    query = query.neq("status", "archived");
  }

  const { data, error } = await query;
  if (error) throw new Error("Failed to load goals");
  // Sorted by priority in application code — 'priority' is a text column
  // ('critical'/'high'/'medium'/'low'), so an ORDER BY on it would sort
  // alphabetically rather than by actual importance.
  const goals = (data ?? []) as FinancialGoal[];
  return goals.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
}

export async function getGoal(id: string): Promise<FinancialGoal | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("financial_goals").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Failed to load goal");
  return data;
}
