import { describe, expect, it } from "vitest";

import { transactionsToCsv } from "@/features/transactions/export";
import { getDictionary } from "@/i18n/dictionaries";
import type { TransactionWithRelations } from "@/features/transactions/queries";

const thDict = getDictionary("th");
const enDict = getDictionary("en");

function baseTx(overrides: Partial<TransactionWithRelations> = {}): TransactionWithRelations {
  return {
    id: "t1",
    user_id: "u1",
    account_id: "a1",
    from_account_id: null,
    to_account_id: null,
    category_id: "c1",
    type: "expense",
    amount: "150.00",
    currency_code: "THB",
    transaction_date: "2026-09-15",
    description: null,
    merchant: "Grab",
    notes: null,
    is_recurring: false,
    source: "manual",
    client_request_id: null,
    created_at: "2026-09-15T00:00:00.000Z",
    updated_at: "2026-09-15T00:00:00.000Z",
    account: { id: "a1", name: "Cash" },
    from_account: null,
    to_account: null,
    category: { id: "c1", name_th: "เดินทาง", name_en: "Transport", icon: null },
    ...overrides,
  };
}

describe("transactionsToCsv", () => {
  it("emits a header row plus one row per transaction, comma-joined", () => {
    const csv = transactionsToCsv([baseTx()], thDict, "th");
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      ["วันที่", "ประเภท", "จำนวนเงิน", "สกุลเงิน", "บัญชี", "หมวดหมู่", "ร้าน/ผู้รับ", "รายละเอียด", "หมายเหตุ"].join(",")
    );
    expect(lines[1]).toBe("2026-09-15,รายจ่าย,150.00,THB,Cash,เดินทาง,Grab,,");
  });

  it("uses the raw decimal amount, never a ฿-formatted/comma-grouped display string", () => {
    const csv = transactionsToCsv([baseTx({ amount: "12345.50" })], thDict, "th");
    expect(csv).toContain("12345.50");
    expect(csv).not.toContain("฿");
    expect(csv).not.toContain("12,345.50");
  });

  it("resolves the category name by locale", () => {
    const csvTh = transactionsToCsv([baseTx()], thDict, "th");
    const csvEn = transactionsToCsv([baseTx()], enDict, "en");
    expect(csvTh).toContain("เดินทาง");
    expect(csvEn).toContain("Transport");
  });

  it("formats a transfer's account column as 'from → to', never a single account name", () => {
    const transfer = baseTx({
      type: "transfer",
      account_id: null,
      from_account_id: "a1",
      to_account_id: "a2",
      category_id: null,
      category: null,
      account: null,
      from_account: { id: "a1", name: "Cash" },
      to_account: { id: "a2", name: "Bank" },
      merchant: null,
    });
    const csv = transactionsToCsv([transfer], thDict, "th");
    expect(csv).toContain("Cash → Bank");
  });

  it("quotes a field containing a comma, so the CSV can't be misread as extra columns", () => {
    const csv = transactionsToCsv([baseTx({ notes: "ค่ากาแฟ, ขนม" })], thDict, "th");
    expect(csv).toContain('"ค่ากาแฟ, ขนม"');
  });

  it("quotes and escapes a field containing an embedded double quote", () => {
    const csv = transactionsToCsv([baseTx({ description: 'he said "hi"' })], thDict, "th");
    expect(csv).toContain('"he said ""hi"""');
  });

  it("returns just the header row for an empty transaction list", () => {
    const csv = transactionsToCsv([], thDict, "th");
    expect(csv.split("\r\n")).toHaveLength(1);
  });
});
