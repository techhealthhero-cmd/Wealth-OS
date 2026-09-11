"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import {
  buildMajorExpenseSchema,
  buildMoneyYearSchema,
  buildQuarterlyPlanSchema,
} from "@/lib/validation/money-year";
import { friendlyDbError } from "@/lib/db-error";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

async function getRequestDictionary() {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  return getDictionary(locale);
}

function parseMoneyYearFormData(formData: FormData) {
  return {
    year: formData.get("year"),
    annual_income_target: formData.get("annual_income_target") ?? 0,
    annual_savings_target: formData.get("annual_savings_target") ?? 0,
    annual_investment_target: formData.get("annual_investment_target") ?? 0,
    annual_debt_reduction_target: formData.get("annual_debt_reduction_target") ?? 0,
    annual_emergency_fund_target: formData.get("annual_emergency_fund_target") ?? 0,
    expected_irregular_income: formData.get("expected_irregular_income") ?? 0,
    expected_irregular_expenses: formData.get("expected_irregular_expenses") ?? 0,
    notes: formData.get("notes") || undefined,
  };
}

export async function createMoneyYear(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildMoneyYearSchema(dict).safeParse(parseMoneyYearFormData(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase.from("money_years").insert({ ...parsed.data, notes: parsed.data.notes || null, user_id: user.id });
  if (error) {
    const message = error.code === "23505" ? dict.moneyYear.duplicateYear : dict.moneyYear.createFailed;
    return { error: friendlyDbError(error, "createMoneyYear", message) };
  }

  revalidatePath("/plan/money-year");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateMoneyYear(
  moneyYearId: string,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildMoneyYearSchema(dict).partial().safeParse(parseMoneyYearFormData(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase
    .from("money_years")
    .update({ ...parsed.data, notes: parsed.data.notes || null })
    .eq("id", moneyYearId)
    .eq("user_id", user.id);
  if (error) return { error: friendlyDbError(error, "updateMoneyYear", dict.moneyYear.updateFailed) };

  revalidatePath("/plan/money-year");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function upsertQuarterlyPlan(
  moneyYearId: string,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildQuarterlyPlanSchema(dict).safeParse({
    quarter: formData.get("quarter"),
    income_target: formData.get("income_target") ?? 0,
    savings_target: formData.get("savings_target") ?? 0,
    investment_target: formData.get("investment_target") ?? 0,
    debt_reduction_target: formData.get("debt_reduction_target") ?? 0,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase
    .from("quarterly_plans")
    .upsert(
      { money_year_id: moneyYearId, user_id: user.id, ...parsed.data, notes: parsed.data.notes || null },
      { onConflict: "money_year_id,quarter" }
    );
  if (error) return { error: friendlyDbError(error, "upsertQuarterlyPlan", dict.moneyYear.quarterSaveFailed) };

  revalidatePath("/plan/money-year");
  return { success: true };
}

export async function createMajorExpense(
  moneyYearId: string,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildMajorExpenseSchema(dict).safeParse({
    name: formData.get("name"),
    amount: formData.get("amount"),
    planned_month: formData.get("planned_month") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase
    .from("money_year_major_expenses")
    .insert({ money_year_id: moneyYearId, user_id: user.id, ...parsed.data });
  if (error) return { error: friendlyDbError(error, "createMajorExpense", dict.moneyYear.expenseSaveFailed) };

  revalidatePath("/plan/money-year");
  return { success: true };
}

export async function toggleMajorExpensePaid(expenseId: string, isPaid: boolean): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase
    .from("money_year_major_expenses")
    .update({ is_paid: isPaid })
    .eq("id", expenseId)
    .eq("user_id", user.id);
  if (error) return { error: friendlyDbError(error, "toggleMajorExpensePaid", dict.moneyYear.expenseSaveFailed) };

  revalidatePath("/plan/money-year");
  return { success: true };
}

export async function deleteMajorExpense(expenseId: string): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase
    .from("money_year_major_expenses")
    .delete()
    .eq("id", expenseId)
    .eq("user_id", user.id);
  if (error) return { error: friendlyDbError(error, "deleteMajorExpense", dict.moneyYear.expenseDeleteFailed) };

  revalidatePath("/plan/money-year");
  return { success: true };
}
