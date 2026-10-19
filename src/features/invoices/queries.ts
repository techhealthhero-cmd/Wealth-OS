import "server-only";
import { invoiceContext, invoiceDbError } from "./server-context";
import { calendarDateSchema, idSchema } from "@/lib/validation/invoices-tax-jar";
import { daysOverdue, summarizeReceivables, displayInvoiceStatus, type WithholdingRatePct } from "@/lib/financial/invoice";
import { parseMoneyToCents } from "@/lib/financial/money";

import { suggestNextInvoiceNumber } from "./number";
import { groupClientSuggestions, type InvoiceListEntry, type InvoiceView, type ReceiveAccount, type InvoiceFormContext } from "./ui-logic";

type Receivable = { id: string; invoice_number: string; client_name: string; due_date: string; net_amount: number; status: "sent" };
export async function getReceivablesSummary(today: string) {
  const { supabase, user, dict } = await invoiceContext();
  if (!user) return { error: dict.common.pleaseLogin };
  if (!calendarDateSchema.safeParse(today).success) return { error: dict.common.invalidInput };
  const rows: (Receivable & { dueDate: string; netReceivableCents: number; daysOverdue: number })[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("invoices").select("id,invoice_number,client_name,due_date,net_amount,status")
      .eq("user_id", user.id).eq("status", "sent").order("due_date", { ascending: true }).order("id").range(offset, offset + 499);
    if (error) return { error: invoiceDbError(error, dict) };
    const page = (data ?? []) as Receivable[];
    rows.push(...page.map(row => ({ ...row, dueDate: row.due_date, netReceivableCents: parseMoneyToCents(row.net_amount), daysOverdue: daysOverdue(row.due_date, today) })));
    if (page.length < 500) break;
  }
  return { success: true as const, ...summarizeReceivables(rows, today), rows };
}

// Read models contain only serializable presentation data; money is integer satang.
type InvoiceRow = import("@/types/database").Database["public"]["Tables"]["invoices"]["Row"];


function listEntry(row: InvoiceRow, today: string): InvoiceListEntry {
  return {
    id: row.id, invoiceNumber: row.invoice_number, clientName: row.client_name, clientIsCompany: row.client_is_company,
    issueDate: row.issue_date, dueDate: row.due_date, status: row.status, displayStatus: displayInvoiceStatus(row.status, row.due_date, today),
    netReceivableCents: parseMoneyToCents(row.net_amount), withholdingRatePct: Number(row.withholding_rate_pct) as WithholdingRatePct,
    paidAt: row.paid_at, daysOverdue: row.status === "sent" ? daysOverdue(row.due_date, today) : 0,
  };
}
async function readInvoiceHistory(ctx: Awaited<ReturnType<typeof invoiceContext>>, userId: string) {
  const rows: InvoiceRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await ctx.supabase.from("invoices").select("*").eq("user_id", userId)
      .order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
    if (error) return { error: invoiceDbError(error, ctx.dict) };
    const page = (data ?? []) as InvoiceRow[];
    rows.push(...page);
    if (page.length < 500) return { rows };
  }
}
export async function listInvoices(today: string) {
  const ctx = await invoiceContext();
  if (!ctx.user) return { error: ctx.dict.common.pleaseLogin };
  if (!calendarDateSchema.safeParse(today).success) return { error: ctx.dict.common.invalidInput };
  const result = await readInvoiceHistory(ctx, ctx.user.id);
  if (!result.rows) return { error: result.error };
  return { success: true as const, invoices: result.rows.map(row => listEntry(row, today)) };
}
export async function getInvoice(id: string, today: string) {
  const ctx = await invoiceContext();
  if (!ctx.user) return { error: ctx.dict.common.pleaseLogin };
  if (!idSchema.safeParse(id).success || !calendarDateSchema.safeParse(today).success) return { error: ctx.dict.common.invalidInput };
  const header = await ctx.supabase.from("invoices").select("*").eq("user_id", ctx.user.id).eq("id", id).maybeSingle();
  if (header.error) return { error: invoiceDbError(header.error, ctx.dict) };
  if (!header.data) return { success: true as const, invoice: null };
  const row = header.data as InvoiceRow;
  const items = await ctx.supabase.from("invoice_items").select("description,quantity,unit_price,position,id").eq("user_id", ctx.user.id).eq("invoice_id", id).order("position").order("id");
  if (items.error) return { error: invoiceDbError(items.error, ctx.dict) };
  let receiveAccountName: string | null = null;
  if (row.receive_account_id) {
    const account = await ctx.supabase.from("accounts").select("name").eq("user_id", ctx.user.id).eq("id", row.receive_account_id).maybeSingle();
    if (account.error) return { error: invoiceDbError(account.error, ctx.dict) };
    receiveAccountName = account.data?.name ?? null;
  }
  const invoice: InvoiceView = { ...listEntry(row, today), receiveAccountId: row.receive_account_id, receiveAccountName, notes: row.notes,
    categoryId: row.category_id, earnProjectId: row.earn_project_id,
    items: (items.data ?? []).map(item => ({ description: item.description, quantity: Number(item.quantity), unitPriceCents: parseMoneyToCents(item.unit_price) })) };
  return { success: true as const, invoice };
}
export async function getInvoiceFormContext(today: string) {
  const ctx = await invoiceContext();
  if (!ctx.user) return { error: ctx.dict.common.pleaseLogin };
  if (!calendarDateSchema.safeParse(today).success) return { error: ctx.dict.common.invalidInput };
  const history = await readInvoiceHistory(ctx, ctx.user.id);
  if (!history.rows) return { error: history.error };
  const accounts: ReceiveAccount[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await ctx.supabase.from("accounts").select("id,name,account_type").eq("user_id", ctx.user.id).eq("is_archived", false)
      .order("sort_order").order("created_at").order("id").range(offset, offset + 499);
    if (result.error) return { error: invoiceDbError(result.error, ctx.dict) };
    const page = result.data ?? [];
    accounts.push(...page);
    if (page.length < 500) break;
  }
  const recentAccountId = history.rows[0]?.receive_account_id;
  const context: InvoiceFormContext = { today, accounts,
    defaultReceiveAccountId: accounts.find(a => a.id === recentAccountId)?.id ?? accounts.find(a => ["bank", "cash"].includes(a.account_type))?.id ?? null,
    suggestedNumber: suggestNextInvoiceNumber(history.rows.map(row => row.invoice_number), Number(today.slice(0,4))),
    clients: groupClientSuggestions(history.rows.map(row => ({ clientName: row.client_name, clientIsCompany: row.client_is_company,
      withholdingRatePct: Number(row.withholding_rate_pct) as WithholdingRatePct, netReceivableCents: parseMoneyToCents(row.net_amount),
      subtotalCents: parseMoneyToCents(row.subtotal_amount), issueDate: row.issue_date, createdAt: row.created_at }))),
  };
  return { success: true as const, context };
}
