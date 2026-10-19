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
  options: { paymentAlreadyPosted?: boolean; deduplicateMerchant?: boolean; resumeInactive?: boolean } = {}
): Promise<{ error?: string; created: boolean; alreadyExists?: boolean }> {
  const parsed = buildRecurringTransactionSchema(dict).safeParse(input);
  if (!parsed.success) return { created: false, error: parsed.error.issues[0]?.message ?? dict.common.invalidInput };
  const d = parsed.data;
  let id: string | undefined;
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
  const row = { ...d, ...(id ? { id } : {}), user_id: userId, next_due_date: nextDue };
  const { error } = await supabase.from("recurring_transactions").insert(row);
  if (error?.code === "23505" && id) {
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
