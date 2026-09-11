import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getBudgetSummary } from "@/features/budget/queries";
import { parseMoneyToCents } from "@/lib/financial/money";
import type { EmergencyFund } from "@/types/database";

export async function getEmergencyFund(): Promise<EmergencyFund | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("emergency_funds").select("*").maybeSingle();
  if (error) throw new Error("Failed to load emergency fund");
  return data;
}

/**
 * Essential monthly expenses, derived from the current month's budget
 * categories flagged `is_essential` — not stored anywhere, so it can never
 * drift from the budget the user actually set up. Returns 0 (with
 * `hasData: false`) when there's no current-month budget to derive it from.
 */
export async function getEssentialMonthlyExpenses(): Promise<{ cents: number; hasData: boolean }> {
  const summary = await getBudgetSummary();
  if (!summary) return { cents: 0, hasData: false };

  const cents = summary.categories
    .filter((c) => c.is_essential)
    .reduce((sum, c) => sum + parseMoneyToCents(c.amount), 0);

  return { cents, hasData: summary.categories.some((c) => c.is_essential) };
}
