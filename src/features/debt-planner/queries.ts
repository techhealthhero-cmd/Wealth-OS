import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getLiabilities } from "@/features/liabilities/queries";
import { calculateDebtPayoffPlan, type DebtInput, type DebtPayoffResult } from "@/lib/financial/debt-planner";
import { parseMoneyToCents } from "@/lib/financial/money";
import type { DebtPlan, Liability } from "@/types/database";
import { throwDbError } from "@/lib/db-error";

export async function getDebtPlan(): Promise<DebtPlan | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("debt_plans").select("*").maybeSingle();
  if (error) throwDbError(error, "debt-planner.getDebtPlan", "Failed to load debt plan");
  return data;
}

export async function getDebtPlanPriorityOrder(debtPlanId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("debt_plan_priorities")
    .select("liability_id")
    .eq("debt_plan_id", debtPlanId)
    .order("priority_order", { ascending: true });
  if (error) throwDbError(error, "debt-planner.getDebtPlanPriorityOrder", "Failed to load debt plan priorities");
  return (data ?? []).map((row) => row.liability_id as string);
}

export interface DebtPlannerSummary {
  liabilities: Liability[];
  plan: DebtPlan | null;
  result: DebtPayoffResult;
}

export async function getDebtPlannerSummary(): Promise<DebtPlannerSummary> {
  const [liabilities, plan] = await Promise.all([getLiabilities(), getDebtPlan()]);
  const includedLiabilities = liabilities.filter((l) => l.include_in_net_worth);

  const debtInputs: DebtInput[] = includedLiabilities.map((l) => ({
    id: l.id,
    name: l.name,
    balanceCents: parseMoneyToCents(l.balance),
    annualInterestRatePercent: l.interest_rate ? Number(l.interest_rate) : null,
    minimumPaymentCents: l.minimum_payment ? parseMoneyToCents(l.minimum_payment) : 0,
  }));

  const strategy = plan?.strategy ?? "avalanche";
  const extraPayment = plan ? parseMoneyToCents(plan.extra_monthly_payment) : 0;
  const customOrder = strategy === "custom" && plan ? await getDebtPlanPriorityOrder(plan.id) : undefined;

  const result = calculateDebtPayoffPlan(debtInputs, strategy, extraPayment, customOrder);

  return { liabilities: includedLiabilities, plan, result };
}
