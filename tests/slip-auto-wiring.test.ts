import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import { classifySlipBatch } from "@/lib/slip/batch";
import { readingModel, reviewModel, slipSavePayloads, optimisticUndoSlipBatch, undoSlipBatch } from "@/features/capture/lib/slip-auto-model";
import { SlipReviewSheet, slipSaveCount } from "@/features/capture/components/slip-auto/slip-review-sheet";
import { aggregateMonthlySpend, monthlyCategoryHref, shiftSpendMonth, spendMonthRange, type MonthlySpendRow } from "@/features/dashboard/lib/monthly-spend";
import type { ParseContext } from "@/lib/capture/transaction-parser";
import { captureSaveSchema } from "@/lib/validation/capture";
const food = "00000000-0000-4000-8000-000000000001";
const income = "00000000-0000-4000-8000-000000000002";
const account = "00000000-0000-4000-8000-000000000003";
const ctx: ParseContext = { accounts: [], categories: [
  { id: food, name_en: "Food & Drinks", name_th: "อาหาร", type: "expense", is_archived: false, is_system: true, icon: null },
  { id: income, name_en: "Salary", name_th: "เงินเดือน", type: "income", is_archived: false, is_system: true, icon: null },
], merchantPreferences: [], today: "2026-10-21" };
const slip = (ref: string, perspective?: "sender" | "receiver" | "own-transfer") => ({ ocrText: `Amount: 100.25 THB\nDate: 20/10/2026\nSender: Salary\nReceiver: coffee\nReference: ${ref}`, perspective, ocrConfidence: 95 });
describe("slip engine to live review", () => {
  it("maps stable IDs, parties, direction, cents, confidence and collapsed duplicates", () => {
    const batch = classifySlipBatch([slip("a", "sender"), slip("b", "receiver"), slip("a", "sender")]);
    const vm = reviewModel(batch, {}, ctx);
    expect(vm.ready.map(r => [r.id, r.title, r.direction, r.amountCents, r.confidence])).toEqual(batch.ready.map(r => [r.clientRequestId, r.direction === "income" ? "Salary" : "coffee", r.direction, 10025, r.slip.overallConfidence]));
    expect(vm.duplicates).toHaveLength(1);
    expect(vm.expense).toEqual({ count: 1, totalCents: 10025 });
    expect(vm.income).toEqual({ count: 1, totalCents: 10025 });
  });
  it("puts unsure items first, defaults unanswered to expense and never double counts an answer", () => {
    const batch = classifySlipBatch([slip("a", "sender"), slip("b")]);
    const id = batch.unsure[0].clientRequestId;
    const before = reviewModel(batch, {}, ctx);
    expect(before.expense.count).toBe(2);
    expect(before.questions[0].id).toBe(id);
    const after = reviewModel(batch, { [id]: { direction: "income" } }, ctx);
    expect(after.income.totalCents).toBe(10025);
    expect(slipSaveCount(after)).toBe(2);
    const html = renderToStaticMarkup(createElement(SlipReviewSheet, { vm: after, onAnswer() {}, onChangeCategory() {}, onSaveAll() {} }));
    expect(html.indexOf("ถามนิดเดียว")).toBeLessThan(html.indexOf("พร้อมบันทึก"));
    expect(after.ready.find(r => r.id === id)?.direction).toBe("income");
  });
  it("uses existing device learning and category edits in review/payloads", () => {
    const batch = classifySlipBatch([slip("a")]);
    const learned: ParseContext = { ...ctx, deviceMemory: [{ key: "coffee", lastUsed: 1, source: "correction", counts: [{ categoryId: food, direction: "expense", count: 3, weight: 9 }] }] };
    expect(reviewModel(batch, {}, learned).expense.count).toBe(1);
    const id = batch.items[0].clientRequestId;
    expect(slipSavePayloads(batch, { [id]: { direction: "income", categoryId: income, confirmed: true } }, ctx, account)[0]).toMatchObject({ categoryId: income, categoryConfirmedByUser: true, type: "income" });
  });
  it("keeps unanswered unsure items as expenses even when device memory suggests income", () => {
    const batch = classifySlipBatch([slip("a")]);
    const learned: ParseContext = { ...ctx, deviceMemory: [{ key: "coffee", lastUsed: 1, source: "correction", counts: [{ categoryId: income, direction: "income", count: 3, weight: 9 }] }] };
    expect(slipSavePayloads(batch, {}, learned, account)[0].type).toBe("expense");
    const lowConfidence = classifySlipBatch([{ ...slip("b", "receiver"), ocrConfidence: 10 }]);
    expect(slipSavePayloads(lowConfidence, {}, ctx, account)[0].type).toBe("expense");
  });
  it("maps Save all with unsure first, duplicate skip, stable request IDs and slip references", () => {
    const batch = classifySlipBatch([slip("a", "receiver"), slip("b"), slip("a", "receiver")]);
    const payloads = slipSavePayloads(batch, {}, ctx, account);
    expect(payloads.map(p => p.type)).toEqual(["expense", "income"]);
    expect(payloads.map(p => p.clientRequestId)).toEqual([batch.unsure[0].clientRequestId, batch.ready[0].clientRequestId]);
    expect(payloads.map(p => p.reference)).toEqual(["b", "a"]);
    expect(payloads.every(p => p.source === "receipt" && p.accountId === account && captureSaveSchema.safeParse(p).success)).toBe(true);
    expect(slipSavePayloads(batch, {}, ctx, account)).toEqual(payloads);
  });
  it("requires missing facts to be corrected and does not post own transfers as expenses", () => {
    const batch = classifySlipBatch([{ ocrText: "unreadable" }]);
    expect(() => slipSavePayloads(batch, {}, ctx, account)).toThrow("จำนวนเงิน");
    const id = batch.items[0].clientRequestId;
    expect(slipSavePayloads(batch, { [id]: { amountCents: 1050, date: "2026-10-20", direction: "expense" } }, ctx, account)[0]).toMatchObject({ amountCents: 1050, date: "2026-10-20" });
    expect(() => slipSavePayloads(classifySlipBatch([slip("own", "own-transfer")]), {}, ctx, account)).toThrow("โอนระหว่างบัญชี");
  });
  it("maps reading progress without retaining any images", () => {
    expect(readingModel(1, 3).thumbs.map(t => t.status)).toEqual(["done", "reading", "waiting"]);
    expect(readingModel(3, 3).done).toBe(3);
  });
});
describe("whole batch undo", () => {
  const saved = ["1", "2", "3"].map(id => ({ id, clientRequestId: `request-${id}` }));
  it("makes exactly one request with every ID", async () => {
    const remove = vi.fn().mockResolvedValue({ success: true, deleted: 3 });
    expect(await undoSlipBatch(saved, remove)).toEqual({ removed: saved, remaining: [] });
    expect(remove).toHaveBeenCalledExactlyOnceWith(["1", "2", "3"]);
  });
  it.each(["error", "throw"])("keeps all rows retryable after %s", async mode => {
    const remove = mode === "error" ? vi.fn().mockResolvedValue({ error: "failed" }) : vi.fn().mockRejectedValue(Error("offline"));
    const result = await undoSlipBatch(saved, remove);
    expect(result).toEqual({ removed: [], remaining: saved });
    expect(remove).toHaveBeenCalledTimes(1);
    const retry = vi.fn().mockResolvedValue({ success: true });
    expect((await undoSlipBatch(result.remaining, retry)).remaining).toEqual([]);
    expect(retry).toHaveBeenCalledExactlyOnceWith(["1", "2", "3"]);
  });
  it("skips empty batches and deduplicates IDs", async () => {
    const remove = vi.fn().mockResolvedValue({ success: true });
    await undoSlipBatch([], remove);
    expect(remove).not.toHaveBeenCalled();
    await undoSlipBatch([saved[0], saved[0]], remove);
    expect(remove).toHaveBeenCalledExactlyOnceWith(["1"]);
  });
  it.each([true, false])("optimistically closes before settling, then restores or refreshes (success=%s)", async success => {
    let settle!: (result: { success: boolean }) => void;
    const order: string[] = [];
    const remove = vi.fn(() => {
      order.push("remove");
      return new Promise<{ success: boolean }>(resolve => { settle = resolve; });
    });
    const snapshot = { saved, stage: "saved", vm: { savedCount: 3 } };
    let state = snapshot;
    const refresh = vi.fn();
    const restore = vi.fn((remaining: typeof saved) => { state = { ...snapshot, saved: remaining }; });
    const pending = optimisticUndoSlipBatch(saved, remove, {
      onOptimistic: () => { order.push("optimistic"); state = { saved: [], stage: "pick", vm: { savedCount: 0 } }; },
      onSuccess: refresh,
      onFailure: restore,
    });
    expect(order).toEqual(["remove", "optimistic"]);
    expect(state.stage).toBe("pick");
    expect(refresh).not.toHaveBeenCalled();
    settle({ success });
    await pending;
    if (success) {
      expect(refresh).toHaveBeenCalledExactlyOnceWith(saved);
      expect(restore).not.toHaveBeenCalled();
    } else {
      expect(state).toEqual(snapshot);
      expect(restore).toHaveBeenCalledExactlyOnceWith(saved);
      expect(refresh).not.toHaveBeenCalled();
    }
  });
});
const row = (id: string, type: MonthlySpendRow["type"], amount: string, category_id: string | null = food, transaction_date = "2026-10-20"): MonthlySpendRow => ({ id, type, amount, category_id, transaction_date, merchant: "synthetic", description: null });
describe("monthly saved-transaction summary", () => {
  it("reuses net-of-refund spending, excludes income/transfers from categories and sorts top spend", () => {
    const summary = aggregateMonthlySpend([row("a", "expense", "100.25"), row("b", "income", "200"), row("c", "transfer", "1000"), row("d", "refund", "20"), row("e", "expense", "150", null), row("f", "savings_transfer", "100"), row("g", "debt_payment", "100"), row("h", "investment_allocation", "100")], ctx.categories, "2026-10", "2026-10");
    expect(summary.spentCents).toBe(23025);
    expect(summary.incomeCents).toBe(20000);
    expect(summary.leftCents).toBe(-3025);
    expect(summary.categories.map(c => [c.id, c.amountCents])).toEqual([["uncategorized", 15000], [food, 10025]]);
    expect(summary.categories.flatMap(c => c.items ?? []).map(i => i.id)).toEqual(["e", "a"]);
    expect(summary.canGoNext).toBe(false);
  });
  it("switches month boundaries, including leap years and December, without leaking adjacent rows", () => {
    expect(shiftSpendMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftSpendMonth("2026-01", -1)).toBe("2025-12");
    expect(spendMonthRange("2024-02").to).toBe("2024-02-29");
    const rows = [row("a", "expense", "5", food, "2026-09-30"), row("b", "expense", "7", food, "2026-10-01")];
    expect(aggregateMonthlySpend(rows, ctx.categories, "2026-09", "2026-10")).toMatchObject({ spentCents: 500, canGoNext: true });
    expect(aggregateMonthlySpend(rows, ctx.categories, "2026-10", "2026-10").spentCents).toBe(700);
    expect(() => spendMonthRange("2026-13")).toThrow();
  });
  it("links to supported category and date filters; uncategorized falls back to the month expense list", () => {
    expect(monthlyCategoryHref("2026-10", food)).toContain(`categoryId=${food}`);
    expect(monthlyCategoryHref("2026-10", food)).toContain("from=2026-10-01&to=2026-10-31&type=expense");
    expect(monthlyCategoryHref("2026-10", "uncategorized")).not.toContain("categoryId");
  });
});
it("the new scan path never imports external AI or scanReceipt", () => {
  for (const path of ["src/features/capture/components/slip-auto/slip-auto-flow.tsx", "src/features/capture/lib/slip-auto-model.ts", "src/features/capture/slip-auto-actions.ts"]) {
    const source = fs.readFileSync(path, "utf8");
    expect(source).not.toMatch(/scanReceipt|features\/ai/);
  }
  const quick = fs.readFileSync("src/features/capture/components/quick-capture-sheet.tsx", "utf8");
  expect(quick).not.toMatch(/scanReceipt|prepareReceiptImage/);
  expect(quick).toContain("slipFlowRef.current?.start(files)");
});
