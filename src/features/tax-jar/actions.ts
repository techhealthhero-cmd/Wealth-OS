"use server";
import { revalidatePath } from "next/cache";
import { invoiceContext, invoiceDbError } from "@/features/invoices/server-context";
import { centsToDecimalString } from "@/lib/financial/money";
import { idSchema, taxJarEntrySchema, taxJarSettingsSchema, type TaxJarEntryInput, type TaxJarSettingsInput } from "@/lib/validation/invoices-tax-jar";

function revalidate() { revalidatePath("/dashboard"); revalidatePath("/money/tax-jar"); }
export async function upsertTaxJarSettings(input: TaxJarSettingsInput) {
  const { supabase, user, dict } = await invoiceContext();
  if (!user) return { error: dict.common.pleaseLogin };
  const parsed = taxJarSettingsSchema.safeParse(input);
  if (!parsed.success) return { error: dict.common.invalidInput };
  const v = parsed.data;
  const { error } = await supabase.from("tax_jar_settings").upsert({
    user_id: user.id, rate_pct: v.ratePct, mode: v.mode, account_id: v.accountId ?? null,
    expense_408_rate_pct: v.expense408RatePct, extra_deductions_amount: centsToDecimalString(v.extraDeductionsCents),
  }, { onConflict: "user_id" });
  if (error) return { error: invoiceDbError(error, dict) };
  revalidate();
  return { success: true as const };
}
export async function addTaxJarEntry(input: TaxJarEntryInput) {
  const { supabase, user, dict } = await invoiceContext();
  if (!user) return { error: dict.common.pleaseLogin };
  const parsed = taxJarEntrySchema.safeParse(input);
  if (!parsed.success) return { error: dict.common.invalidInput };
  const v = parsed.data;
  const { data, error } = await supabase.from("tax_jar_entries").insert({
    user_id: user.id, kind: v.kind, amount: centsToDecimalString(v.amountCents), tax_year: v.taxYear,
    rate_pct: v.rate ?? null, source_transaction_id: v.sourceTransactionId ?? null,
    income_type: v.incomeType ?? null, entry_date: v.entryDate, note: v.note ?? null,
  }).select("id").single();
  if (error?.code === "23505" && v.kind === "set_aside" && v.sourceTransactionId) {
    const existing = await supabase.from("tax_jar_entries").select("id").eq("user_id", user.id)
      .eq("source_transaction_id", v.sourceTransactionId).eq("kind", "set_aside").maybeSingle();
    if (existing.error) return { error: invoiceDbError(existing.error, dict) };
    if (existing.data) { revalidate(); return { success: true as const, id: existing.data.id as string, alreadySetAside: true }; }
  }
  if (error || !data) return { error: invoiceDbError(error ?? { message: "insert returned no row" }, dict) };
  revalidate();
  return { success: true as const, id: data.id as string };
}
export async function deleteTaxJarEntry(id: string) {
  const { supabase, user, dict } = await invoiceContext();
  if (!user) return { error: dict.common.pleaseLogin };
  if (!idSchema.safeParse(id).success) return { error: dict.common.invalidInput };
  const { error } = await supabase.from("tax_jar_entries").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: invoiceDbError(error, dict) };
  revalidate();
  return { success: true as const, id };
}
