import { describe, expect, it } from "vitest";
import { buildIncomeFromPaidInvoice, calculateInvoiceTotals, daysOverdue, displayInvoiceStatus, lineTotalCents, summarizeReceivables, type InvoiceStatus, type WithholdingRatePct } from "@/lib/financial/invoice";

describe("invoice", () => {
  it("calculates the invoice example and defaults to no withholding", () => {
    const items = [{ quantity: 1, unitPriceCents: 800000 }, { quantity: 6, unitPriceCents: 50000 }];
    expect(calculateInvoiceTotals(items, { withholdingRatePct: 3 })).toEqual({ subtotalCents: 1100000, withholdingCents: 33000, netReceivableCents: 1067000 });
    expect(calculateInvoiceTotals(items).netReceivableCents).toBe(1100000);
    expect(calculateInvoiceTotals([])).toEqual({ subtotalCents: 0, withholdingCents: 0, netReceivableCents: 0 });
  });
  it("rounds lines before summing and withholding half-up", () => {
    expect(lineTotalCents({ quantity: 1.5, unitPriceCents: 3 })).toBe(5);
    expect(calculateInvoiceTotals([{ quantity: 0.5, unitPriceCents: 1 }, { quantity: 0.5, unitPriceCents: 1 }]).subtotalCents).toBe(2);
    expect(calculateInvoiceTotals([{ quantity: 1, unitPriceCents: 50 }], { withholdingRatePct: 1 }).withholdingCents).toBe(1);
  });
  it.each([-1, NaN, Infinity, -Infinity])("rejects invalid quantity or price %s", value => {
    expect(() => lineTotalCents({ quantity: value, unitPriceCents: 1 })).toThrow();
    expect(() => lineTotalCents({ quantity: 1, unitPriceCents: value })).toThrow();
  });
  it("rejects invalid rates and overflowing totals", () => {
    expect(() => calculateInvoiceTotals([], { withholdingRatePct: 4 as WithholdingRatePct })).toThrow();
    expect(() => lineTotalCents({ quantity: 2, unitPriceCents: Number.MAX_SAFE_INTEGER })).toThrow();
  });
  it("derives overdue only after the due date for sent invoices", () => {
    expect(displayInvoiceStatus("sent", "2026-10-19", "2026-10-19")).toBe("sent");
    expect(displayInvoiceStatus("sent", "2026-10-18", "2026-10-19")).toBe("overdue");
    for (const status of ["draft", "paid", "void"] as const) expect(displayInvoiceStatus(status, "2026-10-01", "2026-10-19")).toBe(status);
    expect(daysOverdue("2024-02-28", "2024-03-01")).toBe(2);
    expect(daysOverdue("2026-10-20", "2026-10-19")).toBe(0);
    expect(() => daysOverdue("2026-02-30", "2026-03-01")).toThrow();
  });
  it("summarizes only sent receivables, including overdue", () => {
    const invoices = (["sent", "sent", "draft", "paid", "void"] as InvoiceStatus[]).map((status, i) => ({ status, dueDate: i === 1 ? "2026-10-19" : "2026-10-01", netReceivableCents: 100 }));
    expect(summarizeReceivables(invoices, "2026-10-19")).toEqual({ outstandingCents: 200, outstandingCount: 2, overdueCents: 100, overdueCount: 1 });
    expect(summarizeReceivables([], "2026-10-19")).toEqual({ outstandingCents: 0, outstandingCount: 0, overdueCents: 0, overdueCount: 0 });
  });
  it("builds cash income with withholding kept separately", () => {
    expect(buildIncomeFromPaidInvoice({ subtotalCents: 1100000, netReceivableCents: 1067000, withholdingCents: 33000, invoiceNumber: "INV-001", clientName: "Client", accountId: "bank", categoryId: null }, "2026-10-19")).toEqual({ type: "income", amountCents: 1067000, transactionDate: "2026-10-19", accountId: "bank", categoryId: null, description: "INV-001 · Client", withholdingCents: 33000 });
  });
});
