import {
  calculateInvoiceTotals,
  daysOverdue,
  type InvoiceStatus,
  type WithholdingRatePct,
} from "@/lib/financial/invoice";
import { formatMoney } from "@/lib/financial/money";
import type { Dictionary } from "@/i18n/dictionaries";

export const DEFAULT_DUE_DAYS = 15;
export type DisplayStatus = InvoiceStatus | "overdue";
export type InvoiceTab = "unpaid" | "overdue" | "paid";
export type InvoiceItem = { description: string; quantity: number; unitPriceCents: number };
export interface InvoiceListEntry {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientIsCompany: boolean;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  displayStatus: DisplayStatus;
  netReceivableCents: number;
  withholdingRatePct: WithholdingRatePct;
  paidAt: string | null;
  daysOverdue: number;
}
export interface InvoiceView extends InvoiceListEntry {
  items: InvoiceItem[];
  receiveAccountId: string | null;
  receiveAccountName: string | null;
  notes: string | null;
  categoryId?: string | null;
  earnProjectId?: string | null;
}
export type ReceiveAccount = { id: string; name: string; account_type: string };
export interface ClientHistoryRow {
  clientName: string;
  clientIsCompany: boolean;
  withholdingRatePct: WithholdingRatePct;
  netReceivableCents: number;
  subtotalCents: number;
  issueDate: string;
  createdAt: string;
}
export type ClientSuggestion = ClientHistoryRow;
export interface InvoiceFormContext {
  today: string;
  suggestedNumber: string;
  clients: ClientSuggestion[];
  accounts: ReceiveAccount[];
  defaultReceiveAccountId: string | null;
}
function calendarDay(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new Error("Invalid calendar date");
  return date;
}
export function defaultDueDate(issueDate: string): string {
  const date = calendarDay(issueDate);
  date.setUTCDate(date.getUTCDate() + DEFAULT_DUE_DAYS);
  return date.toISOString().slice(0, 10);
}
export function calendarDaysBetween(from: string, to: string) {
  return (calendarDay(to).getTime() - calendarDay(from).getTime()) / 86400000;
}
export function suggestWithholdingRate({
  clientIsCompany,
  previousRatePct,
}: {
  clientIsCompany: boolean;
  previousRatePct?: WithholdingRatePct | null;
}) {
  if (previousRatePct != null) return { ratePct: previousRatePct, reason: "previous" as const };
  return {
    ratePct: clientIsCompany ? (3 as const) : (0 as const),
    reason: clientIsCompany ? ("company" as const) : ("individual" as const),
  };
}
const normalized = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase();
export function groupClientSuggestions(rows: readonly ClientHistoryRow[]): ClientSuggestion[] {
  const seen = new Set<string>();
  return [...rows]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.issueDate.localeCompare(a.issueDate))
    .filter((row) => {
      const key = normalized(row.clientName);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((row) => ({ ...row, clientName: row.clientName.trim() }));
}
export function filterClientSuggestions(list: readonly ClientSuggestion[], query: string) {
  return list.filter((row) => normalized(row.clientName).includes(normalized(query)));
}
export function invoiceTab(status: DisplayStatus): InvoiceTab | null {
  if (status === "void") return null;
  if (status === "paid") return "paid";
  return "unpaid";
}
export function filterByTab<T extends InvoiceListEntry>(rows: readonly T[], tab: InvoiceTab): T[] {
  const rank = { overdue: 0, sent: 1, draft: 2, paid: 3, void: 4 };
  return rows
    .filter((row) => (tab === "overdue" ? row.displayStatus === "overdue" : invoiceTab(row.displayStatus) === tab))
    .sort((a, b) =>
      tab === "paid"
        ? (b.paidAt ?? "").localeCompare(a.paidAt ?? "") || a.id.localeCompare(b.id)
        : rank[a.displayStatus] - rank[b.displayStatus] ||
          b.daysOverdue - a.daysOverdue ||
          a.dueDate.localeCompare(b.dueDate) ||
          a.id.localeCompare(b.id),
    );
}
export function invoiceTabCounts(rows: readonly InvoiceListEntry[]) {
  return {
    unpaid: filterByTab(rows, "unpaid").length,
    overdue: filterByTab(rows, "overdue").length,
    paid: filterByTab(rows, "paid").length,
  };
}
export function formatThaiDate(value: string, short = false, locale: "th" | "en" = "th") {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    day: "numeric",
    month: "short",
    ...(short ? {} : { year: "numeric" as const }),
    timeZone: "UTC",
  }).format(calendarDay(value));
}
export function shortThaiDate(value: string, locale: "th" | "en" = "th") {
  return formatThaiDate(value, true, locale);
}
export const invoiceMoney = (cents: number) => formatMoney(cents, "THB", undefined, cents % 100 === 0 ? 0 : 2);
export function interpolate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));
}
export function buildInvoiceShareText(
  invoice: InvoiceView,
  { copy: c, locale = "th" }: { copy: Dictionary["invoiceUi"]; locale?: "th" | "en" },
) {
  const totals = calculateInvoiceTotals(invoice.items, { withholdingRatePct: invoice.withholdingRatePct });
  return [
    c.shareGreeting,
    `${c.number} ${invoice.invoiceNumber}`,
    `${c.to} ${invoice.clientName}`,
    ...invoice.items.map(
      (item) =>
        `${item.description} ${item.quantity} × ${invoiceMoney(item.unitPriceCents)} = ${invoiceMoney(calculateInvoiceTotals([item]).subtotalCents)}`,
    ),
    `${c.subtotal} ${invoiceMoney(totals.subtotalCents)}`,
    ...(invoice.withholdingRatePct > 0
      ? [`${c.withholding} ${invoice.withholdingRatePct}% −${invoiceMoney(totals.withholdingCents)}`]
      : []),
    `${c.transferAmount} ${invoiceMoney(totals.netReceivableCents)}`,
    `${c.due} ${formatThaiDate(invoice.dueDate, false, locale)}`,
    ...(invoice.receiveAccountName ? [`${c.receive} ${invoice.receiveAccountName}`] : []),
    ...(invoice.notes ? [`${c.notes}: ${invoice.notes}`] : []),
    c.thankYou,
  ].join("\n");
}
export function buildLineShareUrl(text: string) {
  return "https://line.me/R/share?text=" + encodeURIComponent(text);
}
export type ReminderTone = "polite" | "friendly" | "firm";
export type ReminderEnding = "ค่ะ" | "ครับ";
export function buildReminderText(
  invoice: InvoiceView,
  {
    copy: c,
    tone,
    ending,
    today,
  }: { copy: Dictionary["invoiceUi"]; tone: ReminderTone; ending: ReminderEnding; today: string },
) {
  const address = invoice.clientIsCompany
    ? `${c.accounting} ${invoice.clientName}`
    : /^คุณ/.test(invoice.clientName.trim())
      ? invoice.clientName.trim()
      : `คุณ${invoice.clientName.trim()}`;
  const overdue = daysOverdue(invoice.dueDate, today);
  const question = ending === "ค่ะ" ? "คะ" : "ครับ";
  return interpolate(c.reminderTemplates[tone], {
    address,
    ending,
    question,
    number: invoice.invoiceNumber,
    amount: invoiceMoney(invoice.netReceivableCents),
    date: shortThaiDate(invoice.dueDate),
    overdue: overdue > 0 ? interpolate(c.overdueTemplates[tone], { days: overdue }) : "",
  });
}
