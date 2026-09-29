import { describe, expect, it } from "vitest";

import { normalizeImportRow } from "@/lib/import/normalize";
import type { ImportHeaderMapping } from "@/lib/import/csv";

const expenseOther = { id: "other-expense", name_th: "อื่นๆ", name_en: "Other", type: "expense" as const, icon: null, is_system: true };
const incomeOther = { id: "other-income", name_th: "อื่นๆ", name_en: "Other", type: "income" as const, icon: null, is_system: true };
const food = { id: "food", name_th: "อาหาร", name_en: "Food & Dining", type: "expense" as const, icon: null, is_system: true };
const salary = { id: "salary", name_th: "เงินเดือน", name_en: "Salary", type: "income" as const, icon: null, is_system: true };

const context = {
  accountId: "11111111-1111-4111-8111-111111111111",
  accountCurrency: "THB",
  categories: [expenseOther, incomeOther, food, salary],
  merchantPreferences: [{ merchant_normalized: "netflix", category_id: food.id }],
};

const amountMapping: ImportHeaderMapping = {
  date: "date",
  description: "description",
  amount: "amount",
  type: "type",
  reference: "ref",
  currency: "currency",
};

describe("statement row normalization", () => {
  it("normalizes Model A income/expense and Buddhist-era dates", () => {
    const expense = normalizeImportRow(
      { date: "30/09/2569", description: "อาหาร", amount: "1,280.50", type: "รายจ่าย", ref: "A1", currency: "thb" },
      amountMapping,
      context
    );
    expect(expense.status).toBe("ready");
    if (expense.status !== "error") {
      expect(expense.normalized).toMatchObject({ type: "expense", amount: "1280.50", date: "2026-09-30", reference: "A1" });
    }

    const income = normalizeImportRow(
      { date: "2026-09-30", description: "เงินเดือน", amount: "25000", type: "income", ref: "", currency: "" },
      amountMapping,
      context
    );
    expect(income.status).toBe("ready");
  });

  it("normalizes Model B debit and credit deterministically", () => {
    const mapping: ImportHeaderMapping = { date: "d", description: "memo", debit: "out", credit: "in" };
    const debit = normalizeImportRow({ d: "2026-09-01", memo: "ข้าว", out: "80", in: "" }, mapping, context);
    const credit = normalizeImportRow({ d: "2026-09-01", memo: "เงินเดือน", out: "", in: "25000" }, mapping, context);
    expect(debit.status === "error" ? null : debit.normalized.type).toBe("expense");
    expect(credit.status === "error" ? null : credit.normalized.type).toBe("income");
  });

  it("blocks ambiguous or invalid money rows", () => {
    const mapping: ImportHeaderMapping = { date: "d", description: "memo", debit: "out", credit: "in" };
    expect(normalizeImportRow({ d: "2026-09-01", memo: "x", out: "10", in: "20" }, mapping, context)).toEqual({ status: "error", errorCode: "ambiguous_debit_credit" });
    expect(normalizeImportRow({ d: "2026-09-01", memo: "x", out: "", in: "" }, mapping, context)).toEqual({ status: "error", errorCode: "missing_amount" });
    expect(normalizeImportRow({ d: "2026-09-01", memo: "x", out: "0", in: "" }, mapping, context)).toEqual({ status: "error", errorCode: "zero_amount" });
    expect(normalizeImportRow({ d: "2026-09-01", memo: "x", out: "abc", in: "" }, mapping, context)).toEqual({ status: "error", errorCode: "invalid_amount" });
    expect(normalizeImportRow({ date: "2026-09-01", description: "x", amount: "10", type: "", ref: "", currency: "" }, amountMapping, context)).toEqual({ status: "error", errorCode: "ambiguous_amount_sign" });
  });

  it("blocks invalid dates and incompatible currencies", () => {
    expect(normalizeImportRow({ date: "31/02/2026", description: "x", amount: "10", type: "expense", ref: "", currency: "THB" }, amountMapping, context)).toEqual({ status: "error", errorCode: "invalid_date" });
    expect(normalizeImportRow({ date: "2026-09-01", description: "x", amount: "10", type: "expense", ref: "", currency: "USD" }, amountMapping, context)).toEqual({ status: "error", errorCode: "currency_mismatch" });
  });

  it("uses learned merchants before keyword rules and sends unknowns to review", () => {
    const learned = normalizeImportRow({ date: "2026-09-01", description: "Netflix", amount: "419", type: "expense", ref: "", currency: "" }, amountMapping, context);
    expect(learned.status).toBe("ready");
    if (learned.status !== "error") expect(learned.normalized.categorySource).toBe("learned");

    const unknown = normalizeImportRow({ date: "2026-09-01", description: "Unknown XYZ", amount: "99", type: "expense", ref: "", currency: "" }, amountMapping, context);
    expect(unknown.status).toBe("needs_review");
  });

  it("does not collide on same amount with a different merchant or date", () => {
    const one = normalizeImportRow({ date: "2026-09-01", description: "A", amount: "100", type: "expense", ref: "", currency: "" }, amountMapping, context);
    const two = normalizeImportRow({ date: "2026-09-01", description: "B", amount: "100", type: "expense", ref: "", currency: "" }, amountMapping, context);
    const three = normalizeImportRow({ date: "2026-09-02", description: "A", amount: "100", type: "expense", ref: "", currency: "" }, amountMapping, context);
    if (one.status === "error" || two.status === "error" || three.status === "error") throw new Error("fixture failed");
    expect(new Set([one.normalized.fingerprint, two.normalized.fingerprint, three.normalized.fingerprint]).size).toBe(3);
  });
});
