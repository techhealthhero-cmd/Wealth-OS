"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { buildAccountSchema, buildUpdateAccountSchema } from "@/lib/validation/account";
import { friendlyDbError } from "@/lib/db-error";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { trackEvent } from "@/lib/analytics";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

function parseAccountFormData(formData: FormData) {
  return {
    name: formData.get("name"),
    account_type: formData.get("account_type"),
    institution: formData.get("institution") || undefined,
    currency_code: formData.get("currency_code") || undefined,
    opening_balance: formData.get("opening_balance") ?? 0,
    include_in_net_worth: formData.get("include_in_net_worth") === "on",
  };
}

async function getRequestDictionary() {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  return getDictionary(locale);
}

export async function createAccount(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildAccountSchema(dict).safeParse(parseAccountFormData(formData));

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

  // New accounts append to the end of the manually-orderable list rather
  // than defaulting to sort_order 0, which would otherwise jump every new
  // account to the front ahead of the user's existing custom order.
  const { count } = await supabase
    .from("accounts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  // user_id is always derived from the server-side session, never trusted
  // from the client — see validation schemas' ownership note in README.
  const { error } = await supabase.from("accounts").insert({
    ...parsed.data,
    institution: parsed.data.institution || null,
    user_id: user.id,
    sort_order: count ?? 0,
  });

  if (error) {
    return { error: friendlyDbError(error, "createAccount", dict.accounts.createFailed) };
  }

  // Reuses the sort_order count above — same "count already fetched for
  // another reason doubles as the first-of-its-kind check" pattern as
  // goals/actions.ts's createGoal().
  if ((count ?? 0) === 0) trackEvent("first_account_created", user.id);

  revalidatePath("/money/accounts");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateAccount(
  accountId: string,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const parsed = buildUpdateAccountSchema(dict).safeParse(parseAccountFormData(formData));

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

  // RLS also enforces this, but checking user_id here means a mismatched
  // owner gets a clear "not found"-shaped failure instead of a silent no-op.
  const { error } = await supabase
    .from("accounts")
    .update({
      ...parsed.data,
      institution: parsed.data.institution || null,
    })
    .eq("id", accountId)
    .eq("user_id", user.id);

  if (error) {
    return { error: friendlyDbError(error, "updateAccount", dict.accounts.updateFailed) };
  }

  revalidatePath("/money/accounts");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function archiveAccount(accountId: string): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: dict.common.pleaseLogin };
  }

  const { error } = await supabase
    .from("accounts")
    .update({ is_archived: true })
    .eq("id", accountId)
    .eq("user_id", user.id);

  if (error) {
    return { error: friendlyDbError(error, "archiveAccount", dict.accounts.archiveFailed) };
  }

  revalidatePath("/money/accounts");
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * Persists a new manual drag-to-reorder position for the active accounts
 * list. `orderedAccountIds` is the full new order (index = new sort_order)
 * — untrusted client input, so every update is scoped to `.eq("user_id",
 * user.id)` the same way every other write in this file is: an id that
 * isn't actually this user's own account simply matches zero rows rather
 * than being trusted. Writes one row at a time rather than a single batch
 * RPC — fine for an accounts list, which is always a small, human-sized
 * count, and this is a rare user-initiated action, not a hot path.
 */
export async function reorderAccounts(orderedAccountIds: string[]): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: dict.common.pleaseLogin };
  }

  const results = await Promise.all(
    orderedAccountIds.map((accountId, index) =>
      supabase.from("accounts").update({ sort_order: index }).eq("id", accountId).eq("user_id", user.id)
    )
  );

  const firstError = results.find((r) => r.error)?.error;
  if (firstError) {
    return { error: friendlyDbError(firstError, "reorderAccounts", dict.accounts.updateFailed) };
  }

  revalidatePath("/money/accounts");
  revalidatePath("/dashboard");
  return { success: true };
}

/** Reverses `archiveAccount` — see account-card.tsx's confirm copy, which promises the account can be restored. */
export async function unarchiveAccount(accountId: string): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: dict.common.pleaseLogin };
  }

  const { error } = await supabase
    .from("accounts")
    .update({ is_archived: false })
    .eq("id", accountId)
    .eq("user_id", user.id);

  if (error) {
    return { error: friendlyDbError(error, "unarchiveAccount", dict.accounts.archiveFailed) };
  }

  revalidatePath("/money/accounts");
  revalidatePath("/dashboard");
  return { success: true };
}
