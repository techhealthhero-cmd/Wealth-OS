import { normalizeSlipCategoryText } from "./slip-category-text";
import { monthLabel, slipCategoryIcon } from "../components/slip-auto/format";
import type { BatchSlip, SlipBatchResult } from "@/lib/slip/batch";
import { suggestCategory, type ParseContext } from "@/lib/capture/transaction-parser";
import { buildSlipSaveInput } from "./slip-batch-import";
import { captureSaveSchema, type CaptureSaveInput } from "@/lib/validation/capture";
import type { SlipCategoryOption, SlipDirection, SlipReadingViewModel, SlipReviewViewModel } from "../components/slip-auto/types";

export interface SlipSelection {
  direction?: SlipDirection;
  categoryId?: string | null;
  confirmed?: boolean;
  amountCents?: number;
  date?: string;
  accountId?: string;
  reference?: string | null;
}
export type SlipSelections = Record<string, SlipSelection>;
export function slipTitle(item: BatchSlip, direction: SlipDirection): string {
  return (direction === "income" ? item.slip.sender.name : item.slip.receiver.name) ?? "สลิปโอนเงิน";
}
export function slipCategories(ctx: ParseContext): SlipCategoryOption[] {
  return ctx.categories.filter(c => !c.is_archived).flatMap(c =>
    (["expense", "income"] as const).filter(d => c.type === d || c.type === "both").map(direction => ({
      id: c.id, label: c.name_th, direction, icon: direction === "income" ? "income" : slipCategoryIcon(c.name_en),
    })));
}
export function resolveSlip(item: BatchSlip, selection: SlipSelection, ctx: ParseContext) {
  // An unanswered unsure item is always an expense; learning may suggest a
  // category, but cannot establish which bank party belongs to the user.
  const direction = selection.direction ?? (item.status !== "unsure" && item.direction === "income" ? "income" : "expense");
  const title = slipTitle(item, direction);
  const categoryText = normalizeSlipCategoryText(title);
  const suggestion = suggestCategory(categoryText, categoryText, direction, ctx);
  const categories = slipCategories(ctx);
  const categoryId = selection.categoryId === undefined ? suggestion.categoryId : selection.categoryId;
  const category = categories.find(c => c.id === categoryId && c.direction === direction);
  return { direction, title, categoryId: category?.id ?? null, categoryLabel: category?.label ?? "ยังไม่จัดหมวด", icon: category?.icon ?? "other" as const,
    amountCents: selection.amountCents ?? item.slip.amount ?? 0, date: selection.date ?? item.slip.date,
    categorySource: suggestion.source, confirmed: selection.confirmed === true };
}
export function readingModel(completed: number, total: number): SlipReadingViewModel {
  return { done: completed, total, recent: [], thumbs: Array.from({ length: total }, (_, i) => ({ id: String(i), status: i < completed ? "done" : i === completed ? "reading" : "waiting" })) };
}
export function reviewModel(batch: SlipBatchResult, selections: SlipSelections, ctx: ParseContext): SlipReviewViewModel {
  const vm: SlipReviewViewModel = { monthLabel: monthLabel(ctx.today), foundCount: batch.items.length, expense: { count: 0, totalCents: 0 }, income: { count: 0, totalCents: 0 }, questions: [], ready: [], duplicates: [], categories: slipCategories(ctx) };
  for (const item of batch.items) {
    const s = selections[item.clientRequestId] ?? {};
    const row = resolveSlip(item, s, ctx);
    const dateLabel = row.date ?? "ไม่พบวันที่";
    if (item.status === "duplicate") { vm.duplicates.push({ id: item.clientRequestId, title: row.title, amountCents: row.amountCents, direction: row.direction, dateLabel }); continue; }
    vm[row.direction].count++; vm[row.direction].totalCents += row.amountCents;
    if (item.status === "unsure") vm.questions.push({ id: item.clientRequestId, verb: row.direction === "income" ? "รับ" : "โอน", amountCents: row.amountCents, whoLabel: row.title, context: `${dateLabel} · ${item.reason}`, answeredOptionId: s.direction,
      options: [{ id: "expense", label: "รายจ่าย" }, { id: "income", label: "รายรับ" }, { id: "transfer", label: "โอนระหว่างบัญชี" }, { id: "edit", label: "แก้ไขรายละเอียด" }] });
    // Answered questions also expose the existing category chip for correction.
    if (item.status !== "unsure" || s.direction) vm.ready.push({ id: item.clientRequestId, title: row.title, dateLabel, direction: row.direction, amountCents: row.amountCents, categoryId: row.categoryId, categoryLabel: row.categoryLabel, icon: row.icon, confidence: item.slip.overallConfidence });
  }
  return vm;
}
/** Never fabricate missing amount/date or convert an explicitly identified own-transfer. */
export function slipSavePayloads(batch: SlipBatchResult, selections: SlipSelections, ctx: ParseContext, accountId: string): CaptureSaveInput[] {
  return [...batch.unsure, ...batch.ready].map(item => {
    if (item.direction === "transfer") throw new Error("กรุณาบันทึกการโอนระหว่างบัญชีผ่านเมนูโอนเงิน");
    const selection = selections[item.clientRequestId] ?? {};
    const row = resolveSlip(item, selection, ctx);
    const input = buildSlipSaveInput({ ...item, status: "ready", direction: row.direction, slip: { ...item.slip, amount: row.amountCents, date: row.date, reference: selection.reference === undefined ? item.slip.reference : selection.reference } }, { accountId: selection.accountId ?? accountId, categoryId: row.categoryId, categoryConfirmedByUser: row.confirmed });
    if (!input || !captureSaveSchema.safeParse(input).success) throw new Error("กรุณาแก้ไขจำนวนเงิน วันที่ และเลขอ้างอิงของสลิปที่อ่านไม่ชัดก่อนบันทึก");
    return input;
  });
}
export interface SavedSlip { id: string; clientRequestId: string }
/** One atomic server request; keep the entire batch retryable on failure. */
export async function undoSlipBatch(saved: readonly SavedSlip[], remove: (ids: string[]) => Promise<{ error?: string; success?: boolean }>) {
  if (!saved.length) return { remaining: [], removed: [] };
  try {
    const result = await remove([...new Set(saved.map(row => row.id))]);
    if (result.success && !result.error) return { remaining: [], removed: [...saved] };
  } catch { /* A lost response is safe to retry: deleting absent IDs is a no-op. */ }
  return { remaining: [...saved], removed: [] };
}

/** Fire the server request before closing the UI; retain retry state on failure. */
export async function optimisticUndoSlipBatch(
  saved: readonly SavedSlip[],
  remove: Parameters<typeof undoSlipBatch>[1],
  callbacks: {
    onOptimistic: () => void;
    onSuccess: (removed: SavedSlip[]) => void;
    onFailure: (remaining: SavedSlip[]) => void;
  },
) {
  const pending = undoSlipBatch(saved, remove);
  callbacks.onOptimistic();
  const result = await pending;
  if (result.remaining.length) callbacks.onFailure(result.remaining);
  else callbacks.onSuccess(result.removed);
}
