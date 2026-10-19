import "server-only";
import { cache } from "react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { getLocale } from "@/i18n/server";
import { getDictionary } from "@/i18n/dictionaries";
import { friendlyDbError } from "@/lib/db-error";
import { isMissingRelation } from "@/features/earn/v2-queries";

export const invoiceContext = cache(async () => {
  const [profile, supabase, user] = await Promise.all([getProfile(), createClient(), getAuthUser()]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);
  return { supabase, user, dict, locale, timezone: profile?.timezone ?? "Asia/Bangkok" };
});
export function invoiceDbError(error: { code?: string; message: string }, dict: Awaited<ReturnType<typeof invoiceContext>>["dict"]) {
  if (isMissingRelation(error)) return dict.invoices.migrationPending;
  return friendlyDbError(error, "invoices/taxJar", dict.invoices.failed);
}
