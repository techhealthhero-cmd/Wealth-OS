import "server-only";
import { invoiceContext, invoiceDbError } from "./server-context";
import { calendarDateSchema } from "@/lib/validation/invoices-tax-jar";
import { daysOverdue, summarizeReceivables } from "@/lib/financial/invoice";
import { parseMoneyToCents } from "@/lib/financial/money";

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
