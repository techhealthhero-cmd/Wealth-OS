"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { buildRecurringTransactionSchema } from "@/lib/validation/recurring-transaction";
import { calculateNextDueDate, hasEnded, isDue } from "@/lib/financial/recurring";
import { friendlyDbError } from "@/lib/db-error";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { toLocalDateString } from "@/lib/date";
import { splitInstallment } from "@/lib/financial/amortization";
import { parseMoneyToCents, centsToDecimalString } from "@/lib/financial/money";
import { deterministicUuid } from "@/lib/uuid";

import { insertRecurringTransaction } from "./insert";

const PG_UNIQUE_VIOLATION = "23505";

export interface ActionResult {
  error?: string;
  success?: boolean;
  balanceUpdateFailed?: boolean;
}

function parseRecurringFormData(formData: FormData) {
  return {
    type: formData.get("type"),
    amount: formData.get("amount"),
    account_id: formData.get("account_id") || null,
    from_account_id: formData.get("from_account_id") || null,
    to_account_id: formData.get("to_account_id") || null,
    category_id: formData.get("category_id") || null,
    merchant: formData.get("merchant") || null,
    description: formData.get("description") || null,
    frequency: formData.get("frequency"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date") || null,
    is_active: formData.get("is_active") === "on" || formData.get("is_active") === "true",
  };
}

async function getRequestDictionary() {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  return getDictionary(locale);
}

export async function createRecurringTransaction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const result = await insertRecurringTransaction(supabase, user.id, parseRecurringFormData(formData), dict);
  if (result.error) return { error: result.error };

  revalidatePath("/money/recurring");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateRecurringTransaction(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  // Not `.partial()` — Zod v4 disallows `.partial()` on a `.refine()`-ed
  // object schema, and the edit form always resubmits the complete field
  // set anyway (see RecurringTransactionForm's hidden inputs), so the full
  // schema is both required and sufficient here.
  const parsed = buildRecurringTransactionSchema(dict).safeParse(parseRecurringFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase.from("recurring_transactions").update(parsed.data).eq("id", id).eq("user_id", user.id);
  if (error) return { error: friendlyDbError(error, "updateRecurringTransaction", dict.recurring.saveFailed) };

  revalidatePath("/money/recurring");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteRecurringTransaction(id: string): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase.from("recurring_transactions").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: friendlyDbError(error, "deleteRecurringTransaction", dict.recurring.deleteFailed) };

  revalidatePath("/money/recurring");
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * Confirmation-first posting (Day 6 policy decision — see migration
 * 0007's header). Creates the real transaction only now, on explicit user
 * action, then advances `next_due_date` so the same due date can never be
 * confirmed twice.
 */
export async function confirmRecurringTransaction(id: string): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { data: recurring, error: fetchError } = await supabase
    .from("recurring_transactions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (fetchError || !recurring) return { error: friendlyDbError(fetchError ?? { message: "not found" }, "confirmRecurringTransaction", dict.recurring.confirmFailed) };
  // A stale confirmation button must not post a payment after voice/text cancellation.
  if (!recurring.is_active || hasEnded(recurring.end_date ? new Date(`${recurring.end_date}T00:00:00`) : null)) {
    return { error: dict.recurring.notYetDue };
  }
  if (!isDue(new Date(recurring.next_due_date))) return { error: dict.recurring.notYetDue };

  // Idempotency key for THIS specific due occurrence — deterministic
  // (not random) because there's no client form to hold a random key
  // steady across a retry here, only a server action re-invoked by a
  // button click. Deriving it from (recurring.id, next_due_date) gives
  // the same "same intent = same key" property createTransaction's
  // client-generated key gives ordinary transactions: two rapid clicks
  // read the same next_due_date (it hasn't advanced yet) and so derive
  // the SAME key, so the second insert/transfer hits the existing unique
  // constraint instead of creating a second financial event. Confirming
  // the NEXT occurrence later derives a different key (next_due_date has
  // advanced by then), so it is never blocked. Reuses the exact same
  // database uniqueness mechanism as migration 0012 — no second
  // duplicate-prevention system.
  const idempotencyKey = deterministicUuid(`recurring-confirm:${recurring.id}:${recurring.next_due_date}`);

  let balanceUpdateFailed = false;
  if (recurring.liability_id) {
    if (recurring.type !== "expense") return { error: dict.common.invalidInput };
    // Snapshot BEFORE the occurrence lookup: concurrent RPC retries must compare
    // against the same pre-payment balance, even though RPC returns an existing id.
    const { data: liability, error: liabilityError } = await supabase.from("liabilities").select("*")
      .eq("id", recurring.liability_id).eq("user_id", user.id).maybeSingle();
    if (liabilityError || !liability) return { error: dict.recurring.confirmFailed };
    const { data: existing, error: lookupError } = await supabase.from("transactions").select("amount,type")
      .eq("user_id", user.id).eq("client_request_id", idempotencyKey).maybeSingle();
    if (lookupError) return { error: dict.recurring.confirmFailed };
    const paymentCents = parseMoneyToCents(recurring.amount);
    const split = splitInstallment({ balanceCents: parseMoneyToCents(liability.balance), annualRatePct: Number(liability.interest_rate ?? 0), paymentCents });
    let created = !existing;
    let paymentError = false;
    if (liability.linked_account_id) {
      const principal = existing ? existing.type === "transfer" ? parseMoneyToCents(existing.amount) : 0 : split.principalCents;
      if (!existing && principal > 0) {
        const { error } = await supabase.rpc("create_transfer", {
          p_from_account_id: recurring.account_id, p_to_account_id: liability.linked_account_id,
          p_amount: Number(centsToDecimalString(principal)), p_transaction_date: recurring.next_due_date,
          p_description: recurring.description, p_notes: null, p_client_request_id: idempotencyKey,
        });
        if (error) return { error: dict.recurring.confirmFailed };
      }
      // Residual includes a below-interest payment or a contractual overpayment.
      const expense = paymentCents - principal;
      if (expense > 0 || principal === 0) {
        const { error } = await supabase.from("transactions").insert({
          user_id: user.id, type: "expense", account_id: recurring.account_id, category_id: recurring.category_id,
          amount: centsToDecimalString(expense), transaction_date: recurring.next_due_date,
          merchant: recurring.merchant, description: recurring.description, source: "recurring",
          client_request_id: principal > 0 ? deterministicUuid(`recurring-confirm-interest:${recurring.id}:${recurring.next_due_date}`) : idempotencyKey,
        });
        if (error && error.code !== PG_UNIQUE_VIOLATION) paymentError = true;
        if (principal === 0 && error) created = false;
      }
    } else {
      const { error } = await supabase.from("transactions").insert({
        user_id: user.id, type: recurring.type, account_id: recurring.account_id, category_id: recurring.category_id,
        amount: recurring.amount, transaction_date: recurring.next_due_date, merchant: recurring.merchant,
        description: recurring.description, source: "recurring", client_request_id: idempotencyKey,
      });
      if (error && error.code !== PG_UNIQUE_VIOLATION) return { error: dict.recurring.confirmFailed };
      if (error) created = false;
    }
    if (created && split.principalCents > 0) {
      try {
        const { data, error } = await supabase.from("liabilities")
          .update({ balance: centsToDecimalString(split.balanceCents) }).eq("id", liability.id).eq("user_id", user.id)
          .eq("balance", liability.balance).select("id").maybeSingle();
        balanceUpdateFailed = !!error || !data;
      } catch { balanceUpdateFailed = true; }
    }
    if (paymentError) return { error: dict.recurring.confirmFailed, ...(balanceUpdateFailed ? { balanceUpdateFailed: true } : {}) };
  } else if (recurring.type === "transfer") {
    const { error } = await supabase.rpc("create_transfer", {
      p_from_account_id: recurring.from_account_id,
      p_to_account_id: recurring.to_account_id,
      p_amount: Number(recurring.amount),
      p_transaction_date: recurring.next_due_date,
      p_description: recurring.description,
      p_notes: null,
      p_client_request_id: idempotencyKey,
    });
    if (error) return { error: friendlyDbError(error, "confirmRecurringTransaction", dict.recurring.confirmFailed) };
  } else {
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: recurring.type,
      account_id: recurring.account_id,
      category_id: recurring.category_id,
      amount: recurring.amount,
      transaction_date: recurring.next_due_date,
      merchant: recurring.merchant,
      description: recurring.description,
      source: "recurring",
      client_request_id: idempotencyKey,
    });
    // A unique-constraint hit here means this exact occurrence was already
    // confirmed (e.g. a rapid double-click) — the first click's insert
    // already produced the result the user wanted, so this is a safe
    // no-op, not a failure to surface.
    if (error && error.code !== PG_UNIQUE_VIOLATION) {
      return { error: friendlyDbError(error, "confirmRecurringTransaction", dict.recurring.confirmFailed) };
    }
  }

  const nextDue = calculateNextDueDate(new Date(recurring.next_due_date), recurring.frequency);
  const ended = hasEnded(recurring.end_date ? new Date(recurring.end_date) : null, nextDue);

  const { error: updateError } = await supabase
    .from("recurring_transactions")
    .update({ next_due_date: toLocalDateString(nextDue), is_active: !ended })
    .eq("id", id)
    .eq("user_id", user.id);
  if (updateError) return { error: friendlyDbError(updateError, "confirmRecurringTransaction", dict.recurring.confirmFailed) };

  revalidatePath("/money/recurring");
  revalidatePath("/money/transactions");
  if (recurring.liability_id) {
    revalidatePath("/money/liabilities"); revalidatePath("/money/accounts"); revalidatePath("/money/net-worth");
  }
  revalidatePath("/dashboard");
  return { success: true, ...(balanceUpdateFailed ? { balanceUpdateFailed: true } : {}) };
}
