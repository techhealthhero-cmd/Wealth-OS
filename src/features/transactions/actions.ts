"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { buildTransactionSchema, buildTransferSchema } from "@/lib/validation/transaction";
import { friendlyDbError } from "@/lib/db-error";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

function parseTransactionFormData(formData: FormData) {
  return {
    type: formData.get("type"),
    account_id: formData.get("account_id"),
    category_id: formData.get("category_id") || null,
    amount: formData.get("amount"),
    transaction_date: formData.get("transaction_date"),
    description: formData.get("description") || undefined,
    merchant: formData.get("merchant") || undefined,
    notes: formData.get("notes") || undefined,
    is_recurring: formData.get("is_recurring") === "on",
  };
}

async function getRequestDictionary() {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  return getDictionary(locale);
}

export async function createTransaction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildTransactionSchema(dict).safeParse(parseTransactionFormData(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: dict.common.pleaseLogin };
  }

  // RLS re-validates account_id/category_id ownership at the database level
  // regardless of what this handler does — see migration 0001's
  // transactions_insert_own policy. user_id always comes from the session.
  const { error } = await supabase.from("transactions").insert({
    ...parsed.data,
    description: parsed.data.description || null,
    merchant: parsed.data.merchant || null,
    notes: parsed.data.notes || null,
    user_id: user.id,
    source: "manual",
  });

  if (error) {
    return {
      error: friendlyDbError(error, "createTransaction", dict.transactions.saveFailed),
    };
  }

  revalidatePath("/money/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateTransaction(
  transactionId: string,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildTransactionSchema(dict).safeParse(parseTransactionFormData(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: dict.common.pleaseLogin };
  }

  const { error } = await supabase
    .from("transactions")
    .update({
      ...parsed.data,
      description: parsed.data.description || null,
      merchant: parsed.data.merchant || null,
      notes: parsed.data.notes || null,
    })
    .eq("id", transactionId)
    .eq("user_id", user.id);

  if (error) {
    return {
      error: friendlyDbError(error, "updateTransaction", dict.transactions.updateFailed),
    };
  }

  revalidatePath("/money/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteTransaction(transactionId: string): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: dict.common.pleaseLogin };
  }

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId)
    .eq("user_id", user.id);

  if (error) {
    return {
      error: friendlyDbError(error, "deleteTransaction", dict.transactions.deleteFailed),
    };
  }

  revalidatePath("/money/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function createTransfer(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildTransferSchema(dict).safeParse({
    from_account_id: formData.get("from_account_id"),
    to_account_id: formData.get("to_account_id"),
    amount: formData.get("amount"),
    transaction_date: formData.get("transaction_date"),
    description: formData.get("description") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: dict.common.pleaseLogin };
  }

  // Delegates to the create_transfer() database function (migration 0001),
  // which validates account ownership + currency match and inserts the
  // single-row transfer atomically.
  const { error } = await supabase.rpc("create_transfer", {
    p_from_account_id: parsed.data.from_account_id,
    p_to_account_id: parsed.data.to_account_id,
    p_amount: parsed.data.amount,
    p_transaction_date: parsed.data.transaction_date,
    p_description: parsed.data.description || null,
    p_notes: parsed.data.notes || null,
  });

  if (error) {
    return {
      error: friendlyDbError(error, "createTransfer", dict.transactions.transferFailed),
    };
  }

  revalidatePath("/money/transactions");
  revalidatePath("/money/accounts");
  revalidatePath("/dashboard");
  return { success: true };
}
