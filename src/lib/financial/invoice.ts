/** Pure invoice math. All monetary inputs and outputs use integer satang. */
export type InvoiceItemInput = { quantity: number; unitPriceCents: number };
export type InvoiceStatus = "draft" | "sent" | "paid" | "void";
export type WithholdingRatePct = 0 | 1 | 2 | 3 | 5;

function assertMoney(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Money must be non-negative integer satang within the safe range");
  }
}

/** Rounded line amount; fractional quantities are supported. */
export function lineTotalCents(item: InvoiceItemInput): number {
  if (!Number.isFinite(item.quantity) || item.quantity < 0) {
    throw new Error("Quantity must be finite and non-negative");
  }
  assertMoney(item.unitPriceCents);
  const total = Math.round(item.quantity * item.unitPriceCents);
  assertMoney(total);
  return total;
}

/** Sum rounded lines, then round withholding half-up once on the subtotal. */
export function calculateInvoiceTotals(
  items: readonly InvoiceItemInput[],
  { withholdingRatePct = 0 }: { withholdingRatePct?: WithholdingRatePct } = {}
) {
  if (![0, 1, 2, 3, 5].includes(withholdingRatePct)) {
    throw new Error("Unsupported withholding rate");
  }
  const subtotalCents = items.reduce((sum, item) => sum + lineTotalCents(item), 0);
  assertMoney(subtotalCents);
  const withholdingCents = Math.round(subtotalCents * withholdingRatePct / 100);
  return { subtotalCents, withholdingCents, netReceivableCents: subtotalCents - withholdingCents };
}

function dateDay(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Expected YYYY-MM-DD");
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new Error("Invalid calendar date");
  }
  return timestamp / 86_400_000;
}

/** Calendar days past due, clamped to zero; independent of local timezone. */
export function daysOverdue(dueDate: string, today: string): number {
  return Math.max(0, dateDay(today) - dateDay(dueDate));
}

/** Overdue is derived only for sent invoices; stored status is unchanged. */
export function displayInvoiceStatus(status: InvoiceStatus, dueDate: string, today: string): InvoiceStatus | "overdue" {
  return status === "sent" && daysOverdue(dueDate, today) > 0 ? "overdue" : status;
}

/** Outstanding and overdue cash receivables include only sent invoices. */
export function summarizeReceivables(
  invoices: readonly { status: InvoiceStatus; dueDate: string; netReceivableCents: number }[],
  today: string
) {
  const result = { outstandingCents: 0, outstandingCount: 0, overdueCents: 0, overdueCount: 0 };
  for (const invoice of invoices) {
    if (invoice.status !== "sent") continue;
    assertMoney(invoice.netReceivableCents);
    result.outstandingCents += invoice.netReceivableCents;
    result.outstandingCount++;
    if (daysOverdue(invoice.dueDate, today) > 0) {
      result.overdueCents += invoice.netReceivableCents;
      result.overdueCount++;
    }
  }
  assertMoney(result.outstandingCents);
  return result;
}

/** Record cash received as income, retaining withholding separately as tax credit. */
export function buildIncomeFromPaidInvoice(invoice: {
  netReceivableCents: number; withholdingCents: number; subtotalCents: number;
  invoiceNumber: string; clientName: string; accountId: string; categoryId: string | null;
}, paidDate: string) {
  assertMoney(invoice.netReceivableCents);
  assertMoney(invoice.withholdingCents);
  assertMoney(invoice.subtotalCents);
  dateDay(paidDate);
  return {
    type: "income" as const,
    amountCents: invoice.netReceivableCents,
    transactionDate: paidDate,
    accountId: invoice.accountId,
    categoryId: invoice.categoryId,
    description: `${invoice.invoiceNumber} · ${invoice.clientName}`,
    withholdingCents: invoice.withholdingCents,
  };
}
