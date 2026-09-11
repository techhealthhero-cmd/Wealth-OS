"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { buildBudgetCategorySchema, buildBudgetSchema } from "@/lib/validation/budget";
import { friendlyDbError } from "@/lib/db-error";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

function parseBudgetFormData(formData: FormData) {
  return {
    month: formData.get("month"),
    total_budget: formData.get("total_budget") ?? 0,
    planned_savings: formData.get("planned_savings") ?? 0,
    planned_investment: formData.get("planned_investment") ?? 0,
    notes: formData.get("notes") || undefined,
  };
}

async function getRequestDictionary() {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  return getDictionary(locale);
}

export async function createBudget(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildBudgetSchema(dict).safeParse(parseBudgetFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase.from("budgets").insert({
    ...parsed.data,
    notes: parsed.data.notes || null,
    user_id: user.id,
  });

  if (error) {
    // Prevents duplicate/conflicting budget records — see the unique(user_id, month) constraint.
    const message = error.code === "23505" ? dict.budget.duplicateMonth : dict.budget.createFailed;
    return { error: friendlyDbError(error, "createBudget", message) };
  }

  revalidatePath("/money/budget");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateBudget(
  budgetId: string,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildBudgetSchema(dict).partial().safeParse(parseBudgetFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase
    .from("budgets")
    .update({ ...parsed.data, notes: parsed.data.notes || null })
    .eq("id", budgetId)
    .eq("user_id", user.id);

  if (error) return { error: friendlyDbError(error, "updateBudget", dict.budget.updateFailed) };

  revalidatePath("/money/budget");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteBudget(budgetId: string): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase.from("budgets").delete().eq("id", budgetId).eq("user_id", user.id);
  if (error) return { error: friendlyDbError(error, "deleteBudget", dict.budget.deleteFailed) };

  revalidatePath("/money/budget");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function upsertBudgetCategory(
  budgetId: string,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildBudgetCategorySchema(dict).safeParse({
    category_id: formData.get("category_id"),
    amount: formData.get("amount") ?? 0,
    is_fixed: formData.get("is_fixed") === "on",
    is_essential: formData.get("is_essential") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase
    .from("budget_categories")
    .upsert({ budget_id: budgetId, ...parsed.data }, { onConflict: "budget_id,category_id" });

  if (error) return { error: friendlyDbError(error, "upsertBudgetCategory", dict.budget.categorySaveFailed) };

  revalidatePath("/money/budget");
  return { success: true };
}

export async function deleteBudgetCategory(budgetCategoryId: string): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase.from("budget_categories").delete().eq("id", budgetCategoryId);
  if (error) return { error: friendlyDbError(error, "deleteBudgetCategory", dict.budget.categoryDeleteFailed) };

  revalidatePath("/money/budget");
  return { success: true };
}
