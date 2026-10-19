"use server";
import { revalidatePath } from "next/cache";
import { invoiceContext, invoiceDbError } from "./server-context";
import { calculateInvoiceTotals, lineTotalCents } from "@/lib/financial/invoice";
import { calculateSetAside } from "@/lib/financial/tax-jar";
import { centsToDecimalString, parseMoneyToCents } from "@/lib/financial/money";
import { todayInTimeZone } from "@/lib/date";
import { idSchema, invoiceSchema, markInvoicePaidSchema, type InvoiceInput } from "@/lib/validation/invoices-tax-jar";
import { getTaxJarSettings } from "@/features/tax-jar/queries";
import type { Database } from "@/types/database";

type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
export interface InvoiceActionResult { success?: boolean; id?: string; error?: string }
function revalidate(id?: string) {
  revalidatePath("/dashboard"); revalidatePath("/money/invoices");
  if (id) revalidatePath(`/money/invoices/${id}`);
}
export async function createInvoice(input: InvoiceInput): Promise<InvoiceActionResult> {
  return saveInvoice(null, input);
}
export async function updateInvoice(id: string, input: InvoiceInput): Promise<InvoiceActionResult> {
  return saveInvoice(id, input);
}

/** Multi-request save, with cleanup on failure; see README for transaction limits. */
async function saveInvoice(id: string | null, input: InvoiceInput): Promise<InvoiceActionResult> {
  const { supabase, user, dict } = await invoiceContext();
  if (!user) return { error: dict.common.pleaseLogin };
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success || (id !== null && !idSchema.safeParse(id).success)) return { error: dict.common.invalidInput };
  const v = parsed.data;
  let previous: Invoice | null = null;
  let oldItemIds: string[] = [];
  if (id) {
    const { data, error } = await supabase.from("invoices").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (error) return { error: invoiceDbError(error, dict) };
    if (!data) return { error: dict.invoices.notFound };
    previous = data as Invoice;
    if (!["draft", "sent"].includes(previous.status)) return { error: dict.invoices.notEditable };
    const items = await supabase.from("invoice_items").select("id").eq("invoice_id", id).eq("user_id", user.id);
    if (items.error) return { error: invoiceDbError(items.error, dict) };
    oldItemIds = (items.data ?? []).map((row: { id: string }) => row.id);
  }
  if (v.categoryId) {
    const { data, error } = await supabase.from("categories").select("type").eq("id", v.categoryId).maybeSingle();
    if (error) return { error: invoiceDbError(error, dict) };
    if (!data || !["income", "both"].includes(data.type)) return { error: dict.common.invalidInput };
  }
  const totals = calculateInvoiceTotals(v.items, { withholdingRatePct: v.withholdingRatePct });
  const payload = {
    invoice_number: v.invoiceNumber, client_name: v.clientName, client_is_company: v.clientIsCompany,
    issue_date: v.issueDate, due_date: v.dueDate, withholding_rate_pct: v.withholdingRatePct,
    subtotal_amount: centsToDecimalString(totals.subtotalCents), withholding_amount: centsToDecimalString(totals.withholdingCents),
    net_amount: centsToDecimalString(totals.netReceivableCents), receive_account_id: v.receiveAccountId ?? null,
    category_id: v.categoryId ?? null, earn_project_id: v.earnProjectId ?? null, notes: v.notes ?? null,
  };
  const failure = (error: { code?: string; message: string }) => ({ error: error.code === "23505" ? dict.invoices.duplicateNumber : invoiceDbError(error, dict) });
  if (!id) {
    const result = await supabase.from("invoices").insert({ ...payload, user_id: user.id, status: "draft" }).select("id").single();
    if (result.error || !result.data) return failure(result.error ?? { message: "insert returned no row" });
    id = result.data.id as string;
  }
  const invoiceId = id;
  const newItems = v.items.map((item, position) => ({
    id: crypto.randomUUID(), user_id: user.id, invoice_id: invoiceId, position,
    description: item.description, quantity: item.quantity,
    unit_price: centsToDecimalString(item.unitPriceCents), line_total: centsToDecimalString(lineTotalCents(item)),
  }));
  const cleanup = async () => {
    const result = previous
      ? await supabase.from("invoice_items").delete().eq("user_id", user.id).eq("invoice_id", invoiceId).in("id", newItems.map(i => i.id))
      : await supabase.from("invoices").delete().eq("user_id", user.id).eq("id", invoiceId).eq("status", "draft");
    if (result.error) return invoiceDbError(result.error, dict);
  };
  const itemResult = await supabase.from("invoice_items").insert(newItems);
  if (itemResult.error) {
    const cleanupError = await cleanup();
    return cleanupError ? { error: cleanupError } : failure(itemResult.error);
  }
  if (previous) {
    // Compare the version and status again at write time; don't overwrite a paid/void invoice.
    const updated = await supabase.from("invoices").update(payload).eq("id", invoiceId).eq("user_id", user.id)
      .eq("updated_at", previous.updated_at).in("status", ["draft", "sent"]).select("id,updated_at").maybeSingle();
    if (updated.error || !updated.data) {
      const cleanupError = await cleanup();
      return cleanupError ? { error: cleanupError } : updated.error ? failure(updated.error) : { error: dict.invoices.notEditable };
    }
    if (oldItemIds.length) {
      const removed = await supabase.from("invoice_items").delete().eq("user_id", user.id).eq("invoice_id", invoiceId).in("id", oldItemIds);
      if (removed.error) {
        // Keep the original items and restore original header if no subsequent edit/payment occurred.
        const restored = await supabase.from("invoices").update({
          invoice_number: previous.invoice_number, client_name: previous.client_name, client_is_company: previous.client_is_company,
          issue_date: previous.issue_date, due_date: previous.due_date, withholding_rate_pct: previous.withholding_rate_pct,
          subtotal_amount: previous.subtotal_amount, withholding_amount: previous.withholding_amount, net_amount: previous.net_amount,
          receive_account_id: previous.receive_account_id, category_id: previous.category_id, earn_project_id: previous.earn_project_id, notes: previous.notes,
        }).eq("id", invoiceId).eq("user_id", user.id).in("status", ["draft", "sent"]).eq("updated_at", updated.data.updated_at).select("id").maybeSingle();
        if (restored.error || !restored.data) { revalidate(invoiceId); return failure(restored.error ?? { message: "Invoice changed during failed save; reload before retrying" }); }
        const cleanupError = await cleanup();
        revalidate(invoiceId);
        return cleanupError ? { error: cleanupError } : failure(removed.error);
      }
    }
  }
  revalidate(invoiceId);
  return { success: true, id: invoiceId };
}

export async function markInvoiceSent(id: string): Promise<InvoiceActionResult> {
  return changeStatus(id, "sent");
}
export async function sendInvoice(id: string): Promise<InvoiceActionResult> { return markInvoiceSent(id); }
export async function voidInvoice(id: string): Promise<InvoiceActionResult> { return changeStatus(id, "void"); }
async function changeStatus(id: string, status: "sent" | "void"): Promise<InvoiceActionResult> {
  const { supabase, user, dict } = await invoiceContext();
  if (!user) return { error: dict.common.pleaseLogin };
  if (!idSchema.safeParse(id).success) return { error: dict.common.invalidInput };
  const { data, error } = await supabase.from("invoices").update(status === "sent" ? { status, sent_at: new Date().toISOString() } : { status })
    .eq("id", id).eq("user_id", user.id).in("status", status === "sent" ? ["draft"] : ["draft", "sent", "void"]).select("id").maybeSingle();
  if (error) return { error: invoiceDbError(error, dict) };
  if (!data) return { error: dict.invoices.notEditable };
  revalidate(id);
  return { success: true, id };
}

export async function markInvoicePaid(input: { invoiceId: string; paidDate: string; accountId?: string | null; allowDraft?: boolean }) {
  const { supabase, user, dict, timezone } = await invoiceContext();
  if (!user) return { error: dict.common.pleaseLogin };
  const parsed = markInvoicePaidSchema.safeParse(input);
  if (!parsed.success || parsed.data.paidDate > todayInTimeZone(timezone)) return { error: dict.common.invalidInput };
  const v = parsed.data;
  // Read settings before committing income so a settings failure is safe to retry.
  const settings = await getTaxJarSettings();
  if (settings.error || !settings.settings) return { error: settings.error ?? dict.invoices.failed };
  const { data, error } = await supabase.rpc("mark_invoice_paid", {
    p_invoice_id: v.invoiceId, p_paid_date: v.paidDate, p_account_id: v.accountId ?? null, p_allow_draft: v.allowDraft,
  });
  if (error) {
    const messages: Record<string, string> = {
      invoice_void: dict.invoices.void, invoice_not_sent: dict.invoices.notSent, invoice_not_found: dict.invoices.notFound,
      account_not_found: dict.invoices.accountNotFound, not_authenticated: dict.common.pleaseLogin,
      invalid_amount: dict.common.invalidInput, client_request_id_conflict: dict.common.invalidInput,
    };
    return { error: Object.hasOwn(messages, error.message) ? messages[error.message] : invoiceDbError(error, dict) };
  }
  if (!data) return { error: dict.invoices.failed };
  revalidate(v.invoiceId); revalidatePath("/money/transactions");
  // Use the recorded cash, including on idempotent retries.
  const invoice = await supabase.from("invoices").select("net_amount").eq("id", v.invoiceId).eq("user_id", user.id).single();
  if (invoice.error || !invoice.data) {
    // Payment has committed. Preserve its successful id; the UI may retry to obtain the suggestion.
    return { success: true as const, transactionId: data as string, setAsideSuggestion: null,
      suggestionError: invoice.error ? invoiceDbError(invoice.error, dict) : dict.invoices.notFound };
  }
  return { success: true as const, transactionId: data as string, setAsideSuggestion: {
    amountCents: calculateSetAside(parseMoneyToCents(invoice.data.net_amount), settings.settings.ratePct),
    ratePct: settings.settings.ratePct, mode: settings.settings.mode,
  } };
}
