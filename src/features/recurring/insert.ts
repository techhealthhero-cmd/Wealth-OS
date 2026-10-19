import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Dictionary } from "@/i18n/dictionaries";
import { buildRecurringTransactionSchema } from "@/lib/validation/recurring-transaction";
import { calculateNextDueDate } from "@/lib/financial/recurring";
import { toLocalDateString } from "@/lib/date";
import { normalizeMerchant } from "@/lib/capture/transaction-parser";
import { deterministicUuid } from "@/lib/uuid";
import { friendlyDbError } from "@/lib/db-error";

/** Internal insert path. Callers supply their authenticated user, never a client user id. */
export async function insertRecurringTransaction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  input: unknown,
  dict: Dictionary,
  options: { liabilityId?: string; idempotencyId?: string; paymentAlreadyPosted?: boolean; deduplicateMerchant?: boolean; resumeInactive?: boolean } = {}
): Promise<{ error?: string; created: boolean; alreadyExists?: boolean }> {
  const parsed = buildRecurringTransactionSchema(dict).safeParse(input);
  if (!parsed.success) return { created: false, error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };
  const d = parsed.data;
  let id: string | undefined = options.idempotencyId;
  if (options.deduplicateMerchant && d.merchant) {
    // Escape ILIKE wildcards: dedupe an exact merchant, not a pattern supplied by a user.
    const escaped = d.merchant.replace(/[\\%_]/g, "\\$&");
    const { data, error } = await supabase.from("recurring_transactions").select("id")
      .eq("user_id", userId).eq("is_active", true).ilike("merchant", escaped).limit(1);
    if (error) return { created: false, error: dict.recurring.saveFailed };
    if (data?.length) return { created: false, alreadyExists: true };
    // PK collision also guards simultaneous capture confirms without a schema change.
    // A cancelled schedule is never reactivated by a retry of the original capture.
    id = deterministicUuid(`capture-subscription:${userId}:${normalizeMerchant(d.merchant)}`);
  }
  const nextDue = options.paymentAlreadyPosted
    ? toLocalDateString(calculateNextDueDate(new Date(`${d.start_date}T00:00:00`), d.frequency))
    : d.start_date;
  if (options.liabilityId) {
    const { data, error } = await supabase.from("liabilities").select("id").eq("id", options.liabilityId).eq("user_id", userId).maybeSingle();
    if (error || !data) return { created: false, error: dict.recurring.saveFailed };
  }
  const row = { ...d, ...(options.liabilityId ? { liability_id: options.liabilityId } : {}), ...(id ? { id } : {}), user_id: userId, next_due_date: nextDue };
  let { error } = await supabase.from("recurring_transactions").insert(row);
  if (options.liabilityId && (error?.code === "42703" || error?.code === "PGRST204")) {
    const { liability_id: _link, ...legacy } = row;
    void _link;
    ({ error } = await supabase.from("recurring_transactions").insert(legacy));
  }
  if (error?.code === "23505" && id) {
    if (options.liabilityId) {
      // A retry after 0048 reaches production can complete the link omitted
      // by the compatibility insert. Preserve an explicitly edited link.
      const { error: linkError } = await supabase.from("recurring_transactions")
        .update({ liability_id: options.liabilityId }).eq("id", id).eq("user_id", userId).is("liability_id", null);
      if (linkError && linkError.code !== "42703" && linkError.code !== "PGRST204") return { created: false, error: dict.recurring.saveFailed };
    }
    if (options.resumeInactive) {
      // A NEW confirmed signup may reuse its capture-created schedule after cancellation.
      // Retries of the old payment never reactivate it. Historical payments remain intact.
      const { data, error: resumeError } = await supabase.from("recurring_transactions")
        .update({ ...d, next_due_date: nextDue }).eq("id", id).eq("user_id", userId)
        .eq("is_active", false).select("id").maybeSingle();
      if (resumeError) return { created: false, error: dict.recurring.saveFailed };
      if (data) return { created: true };
    }
    return { created: false, alreadyExists: true };
  }
  if (error) return { created: false, error: friendlyDbError(error, "insertRecurringTransaction", dict.recurring.saveFailed) };
  return { created: true };
}
