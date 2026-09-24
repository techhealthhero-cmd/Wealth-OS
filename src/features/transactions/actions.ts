"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { buildTransactionSchema, buildTransferSchema } from "@/lib/validation/transaction";
import { friendlyDbError } from "@/lib/db-error";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import {
  getTransactionsPage,
  TRANSACTIONS_PAGE_SIZE,
  type TransactionFilters,
  type TransactionsPage,
} from "@/features/transactions/queries";
import { trackEvent } from "@/lib/analytics";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

/** Postgres SQLSTATE this file branches on — see each call site for why. */
const PG_UNIQUE_VIOLATION = "23505";

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

/**
 * Reads the client-generated idempotency key (see transaction-form.tsx /
 * transfer-form.tsx: one fresh UUID per form open, resent unchanged on any
 * retry of that same submit attempt). Absent for an old client or a caller
 * that never sends one — that's a supported, safe case (see Scenario F in
 * the migration/PROJECT_STATUS notes), not an error; the insert just
 * proceeds without idempotency protection for that one call, exactly like
 * before this feature existed.
 */
function readClientRequestId(formData: FormData): string | null {
  const raw = formData.get("client_request_id");
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

/**
 * Reliability lesson carried over from onboarding's double-submit fix (see
 * `completeOnboarding`): a rapid double-click or a network retry can invoke
 * a create action twice before the client's `disabled` state takes effect.
 * Onboarding could guard with a one-time compare-and-swap flag; a
 * transaction has no such natural "already done" state since the same user
 * legitimately creates many similar transactions over time (two separate
 * ฿80 coffees is a real, valid case) — so correctness must never depend on
 * the transaction's *content*.
 *
 * MECHANISM: a client-generated idempotency key (`client_request_id`, one
 * fresh UUID per form open, resent unchanged on retry — see
 * transaction-form.tsx) enforced by a real database unique constraint
 * (migration 0012, applied everywhere this app runs — see CLAUDE.md
 * "TRANSACTION IDEMPOTENCY"): `unique(user_id, client_request_id) where
 * client_request_id is not null`. This is atomic — checked by Postgres as
 * part of the INSERT itself, not by a separate read-then-write step — and
 * correct across any number of concurrent server instances, because the
 * constraint lives in the database, not in this process's memory. A
 * retried attempt (same key) hits the unique constraint and is treated as
 * an already-successful save, never a second row.
 */
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

  const clientRequestId = readClientRequestId(formData);

  // Existence check (not an exact count) — this runs on every save, unlike
  // goals/accounts' one-time-ish creation, so a plain "does at least one
  // row already exist" is cheaper than a full COUNT(*) for something only
  // ever compared against zero.
  const { data: existingTransaction } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);
  const isFirstTransaction = (existingTransaction?.length ?? 0) === 0;

  const basePayload = {
    ...parsed.data,
    description: parsed.data.description || null,
    merchant: parsed.data.merchant || null,
    notes: parsed.data.notes || null,
    category_id: parsed.data.category_id ?? null,
    user_id: user.id,
    source: "manual" as const,
  };

  // RLS re-validates account_id/category_id ownership at the database level
  // regardless of what this handler does — see migration 0001's
  // transactions_insert_own policy. user_id always comes from the session.
  const { error } = await supabase
    .from("transactions")
    .insert({ ...basePayload, client_request_id: clientRequestId });

  if (!error) {
    if (isFirstTransaction) trackEvent("first_transaction_created", user.id);
    revalidatePath("/money/transactions");
    revalidatePath("/dashboard");
    return { success: true };
  }

  if (error.code === PG_UNIQUE_VIOLATION) {
    // The exact same submit attempt was already saved — a safe no-op, not
    // an error the user should see.
    revalidatePath("/money/transactions");
    revalidatePath("/dashboard");
    return { success: true };
  }

  return { error: friendlyDbError(error, "createTransaction", dict.transactions.saveFailed) };
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

/**
 * Transfer idempotency is handled INSIDE create_transfer() itself (migration
 * 0012), not here — a transfer is already a single-row insert (see
 * 0001_init.sql's header, reason #3), so the RPC's own `ON CONFLICT ... DO
 * UPDATE ... RETURNING` makes a retried attempt atomically return the
 * already-created row instead of raising an error or inserting twice. This
 * keeps the transfer's atomicity guarantee entirely inside the database
 * function, per this task's explicit instruction not to rely on a
 * pre-check in the Server Action for something that must stay atomic.
 */
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

  const clientRequestId = readClientRequestId(formData);

  const { error } = await supabase.rpc("create_transfer", {
    p_from_account_id: parsed.data.from_account_id,
    p_to_account_id: parsed.data.to_account_id,
    p_amount: parsed.data.amount,
    p_transaction_date: parsed.data.transaction_date,
    p_description: parsed.data.description || null,
    p_notes: parsed.data.notes || null,
    p_client_request_id: clientRequestId,
  });

  if (!error) {
    revalidatePath("/money/transactions");
    revalidatePath("/money/accounts");
    revalidatePath("/dashboard");
    return { success: true };
  }

  return {
    error: friendlyDbError(error, "createTransfer", dict.transactions.transferFailed),
  };
}

/**
 * Edits an existing transfer in place (same row — a transfer is a single
 * `transactions` row, not two linked ones — see createTransfer's own doc
 * comment above). No idempotency key needed here: unlike a create, a
 * retried update just re-applies to the same `transactionId`, so there's
 * no "second row" failure mode a key would need to guard against.
 * update_transfer() (migration 0015) does the actual validation/ownership
 * checks and lets the existing recalc-balance trigger handle both the old
 * and new accounts' balances correctly.
 */
export async function updateTransfer(
  transactionId: string,
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

  const { error } = await supabase.rpc("update_transfer", {
    p_transaction_id: transactionId,
    p_from_account_id: parsed.data.from_account_id,
    p_to_account_id: parsed.data.to_account_id,
    p_amount: parsed.data.amount,
    p_transaction_date: parsed.data.transaction_date,
    p_description: parsed.data.description || null,
    p_notes: parsed.data.notes || null,
  });

  if (!error) {
    revalidatePath("/money/transactions");
    revalidatePath("/money/accounts");
    revalidatePath("/dashboard");
    return { success: true };
  }

  return {
    error: friendlyDbError(error, "updateTransfer", dict.transactions.updateFailed),
  };
}

export type LoadMoreTransactionsResult = TransactionsPage | { error: string };

/**
 * Perf audit finding: /money/transactions previously fetched a user's ENTIRE
 * history on every visit. The list now renders only the first
 * TRANSACTIONS_PAGE_SIZE rows server-side; this action fetches subsequent
 * pages on demand from a "Load more" tap. `filters` never carries `limit`/
 * `offset` from the caller — those are this action's own concern (matches
 * getTransactionsPage()'s signature), so a client can't request an
 * arbitrarily large page.
 */
export async function loadMoreTransactions(
  filters: Omit<TransactionFilters, "limit" | "offset">,
  offset: number
): Promise<LoadMoreTransactionsResult> {
  const dict = await getRequestDictionary();
  try {
    return await getTransactionsPage(filters, offset, TRANSACTIONS_PAGE_SIZE);
  } catch {
    return { error: dict.common.somethingWentWrong };
  }
}
