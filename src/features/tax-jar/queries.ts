import "server-only";
import { invoiceContext, invoiceDbError } from "@/features/invoices/server-context";
import { parseMoneyToCents } from "@/lib/financial/money";
import { taxYearSchema } from "@/lib/validation/invoices-tax-jar";
import type { Database } from "@/types/database";

export const DEFAULT_TAX_JAR_SETTINGS = {
  ratePct: 7, mode: "ask" as const, accountId: null as string | null,
  expense408RatePct: 60, extraDeductionsCents: 0,
};
export async function getTaxJarSettings() {
  const { supabase, user, dict } = await invoiceContext();
  if (!user) return { error: dict.common.pleaseLogin };
  const { data, error } = await supabase.from("tax_jar_settings").select("*").eq("user_id", user.id).maybeSingle();
  if (error) return { error: invoiceDbError(error, dict) };
  const row = data as Database["public"]["Tables"]["tax_jar_settings"]["Row"] | null;
  return { success: true as const, configured: row !== null, settings: row ? {
    ratePct: Number(row.rate_pct), mode: row.mode, accountId: row.account_id,
    expense408RatePct: Number(row.expense_408_rate_pct), extraDeductionsCents: parseMoneyToCents(row.extra_deductions_amount),
  } : { ...DEFAULT_TAX_JAR_SETTINGS } };
}

export async function getTaxJarSummary(taxYear: number) {
  const { supabase, user, dict } = await invoiceContext();
  if (!user) return { error: dict.common.pleaseLogin };
  if (!taxYearSchema.safeParse(taxYear).success) return { error: dict.common.invalidInput };
  // Page through the ledger: PostgREST's default row cap must not truncate balance.
  const entries: (Database["public"]["Tables"]["tax_jar_entries"]["Row"] & { amountCents: number })[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("tax_jar_entries").select("*")
      .eq("user_id", user.id).eq("tax_year", taxYear).order("entry_date", { ascending: false }).order("id").range(offset, offset + 499);
    if (error) return { error: invoiceDbError(error, dict) };
    const rows = (data ?? []) as Database["public"]["Tables"]["tax_jar_entries"]["Row"][];
    entries.push(...rows.map(row => ({ ...row, amountCents: parseMoneyToCents(row.amount) })));
    if (rows.length < 500) break;
  }
  const balanceCents = entries.reduce((sum, row) => sum + (row.kind === "withdraw" ? -row.amountCents : row.amountCents), 0);
  if (!Number.isSafeInteger(balanceCents)) return { error: dict.common.invalidInput };
  return { success: true as const, balanceCents, entries };
}
