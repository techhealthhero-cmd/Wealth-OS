import { describe, expect, it } from "vitest";
import { BankCode, matchSlipToTransactions, parseSlipText, type SlipTransaction } from "@/lib/slip";
const slip = parseSlipText("19/10/2569 14:05:33\nFrom: Synthetic Sender\nKBank\nxxx-1234\nTo: Synthetic Receiver\nSCB\nxxx-5678\nAmount 100.25\nRef FAKE123");
const row = (id: string, extra: Partial<SlipTransaction> = {}): SlipTransaction => ({ id, amount: "100.25", type: "expense", transaction_date: "2026-10-19T14:05:33+07:00", ...extra });

describe("matchSlipToTransactions", () => {
  it("ranks amount, time, direction and own account/bank hints", () => {
    const matches = matchSlipToTransactions(slip, [row("wrong-side", { type: "income" }), row("plain"), row("best", { bank: BankCode.KBANK, account: "000-1234" })]);
    expect(matches.map((match) => match.transaction.id)).toEqual(["best", "plain", "wrong-side"]);
    expect(matches[0].reasons).toEqual(expect.arrayContaining(["amount_exact", "account_match", "bank_match", "direction_match"]));
    expect(matches[2].likelyDuplicate).toBe(false);
  });
  it("uses exact amounts by default and integer tolerance on request", () => {
    expect(matchSlipToTransactions(slip, [row("near", { amount: "100.26" })])).toEqual([]);
    expect(matchSlipToTransactions(slip, [row("near", { amount: "100.26" })], { amountToleranceMinor: 1 })[0].reasons).toContain("amount_within_tolerance");
  });
  it("enforces timestamp windows including zero", () => {
    expect(matchSlipToTransactions(slip, [row("late", { transaction_date: "2026-10-19T14:06:33+07:00" })], { timeWindowMinutes: 0 })).toEqual([]);
    expect(matchSlipToTransactions(slip, [row("late", { transaction_date: "2026-10-21" })])).toEqual([]);
  });
  it("compares calendar-only dates in Bangkok without duplicate time evidence", () => {
    const matches = matchSlipToTransactions(slip, [row("day", { transaction_date: "2026-10-19" })], { timeWindowMinutes: 0 });
    expect(matches[0].reasons).toContain("date_within_window");
    expect(matches[0].likelyDuplicate).toBe(false);
    const dateOnly = parseSlipText("19/10/2569\nAmount 100.25");
    expect(matchSlipToTransactions(dateOnly, [row("utc", { transaction_date: "2026-10-18T18:00:00Z" })], { timeWindowMinutes: 0 })).toHaveLength(1);
  });
  it("supports receiver perspective", () => {
    const matches = matchSlipToTransactions(slip, [row("income", { type: "income", bank: BankCode.SCB, account: "5678" })], { perspective: "receiver" });
    expect(matches[0].reasons).toEqual(expect.arrayContaining(["direction_match", "account_match", "bank_match"]));
  });
  it("flags matching references even with amount/time discrepancies", () => {
    const match = matchSlipToTransactions(slip, [row("ref", { amount: "200.00", transaction_date: "2020-01-01", reference: " fake123 " })])[0];
    expect(match.likelyDuplicate).toBe(true);
    expect(match.reasons).toContain("duplicate_reference");
  });
  it("flags exact amount and near-identical time with a configurable threshold", () => {
    expect(matchSlipToTransactions(slip, [row("duplicate")])[0].likelyDuplicate).toBe(true);
    expect(matchSlipToTransactions(slip, [row("later", { transaction_date: "2026-10-19T14:05:35+07:00" })], { duplicateWindowSeconds: 1 })[0].likelyDuplicate).toBe(false);
  });
  it("keeps input order for equal scores and does not mutate input", () => {
    const transactions = Object.freeze([Object.freeze(row("z")), Object.freeze(row("a"))]);
    expect(matchSlipToTransactions(slip, transactions).map((m) => m.transaction.id)).toEqual(["z", "a"]);
  });
  it("handles missing and invalid values without matching unrelated currencies", () => {
    expect(matchSlipToTransactions(parseSlipText(""), [row("empty")])).toEqual([]);
    expect(matchSlipToTransactions(slip, [row("bad", { amount: "bad" }), row("usd", { currency_code: "USD" })])).toEqual([]);
    const matches = matchSlipToTransactions(slip, [row("invalid-date", { transaction_date: "2026-02-31" })]);
    expect(matches[0].likelyDuplicate).toBe(false);
    expect(matches[0].reasons).not.toContain("date_within_window");
  });
  it("penalizes contradictory hints without treating tiny visible suffixes as evidence", () => {
    const match = matchSlipToTransactions(slip, [row("wrong", { bank: BankCode.SCB, account: "9999" })])[0];
    expect(match.reasons).toContain("account_mismatch");
    expect(match.reasons).toContain("bank_mismatch");
    expect(matchSlipToTransactions(slip, [row("short", { account: "xx-4" })])[0].reasons).not.toContain("account_match");
  });
});
