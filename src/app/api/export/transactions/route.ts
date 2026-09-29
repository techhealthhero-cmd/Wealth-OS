import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { getTransactions } from "@/features/transactions/queries";
import { transactionsToCsv } from "@/features/transactions/export";
import { requireFeature, FEATURES } from "@/lib/billing/entitlements";

/**
 * Pro-only CSV export of the signed-in user's full transaction history.
 * Gated server-side (never just a hidden UI button) — a Free/Plus request
 * here is rejected before any data is even fetched, same pattern as every
 * other `requireFeature()` gate in this app (see plan/forecast/page.tsx
 * etc.). `getTransactions()` is already scoped to the caller's own rows via
 * RLS, same as every other read in the app — this route adds no new data
 * access path, just a new way to receive already-authorized data.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  const gate = await requireFeature(FEATURES.DATA_EXPORT);
  if (!gate.allowed) {
    return Response.json({ error: dict.export.lockedDescription }, { status: 403 });
  }

  const transactions = await getTransactions({});
  const csv = transactionsToCsv(transactions, dict, locale);
  // UTF-8 BOM so Excel (still the most common CSV consumer) detects the
  // encoding correctly and doesn't mangle Thai text into question marks.
  const bom = "﻿";

  return new Response(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wealth-os-transactions-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
