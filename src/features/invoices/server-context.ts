import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { getLocale } from "@/i18n/server";
import { getDictionary } from "@/i18n/dictionaries";
import { friendlyDbError } from "@/lib/db-error";
import { isMissingRelation } from "@/features/earn/v2-queries";

export async function invoiceContext() {
  const profile = await getProfile();
  const dict = getDictionary(await getLocale(profile?.preferred_language));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user, dict, timezone: profile?.timezone ?? "Asia/Bangkok" };
}
export function invoiceDbError(error: { code?: string; message: string }, dict: Awaited<ReturnType<typeof invoiceContext>>["dict"]) {
  if (isMissingRelation(error)) return dict.invoices.migrationPending;
  return friendlyDbError(error, "invoices/taxJar", dict.invoices.failed);
}
