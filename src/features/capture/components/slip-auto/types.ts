/**
 * UI view-models for the "slip -> auto income/expense + monthly summary" flow.
 *
 * Presentational only: every amount is integer satang ("cents", same unit as
 * ParsedSlip.amount / formatMoney) and every total is computed by the caller
 * — these components never do money math beyond display scaling.
 *
 * TODO(codex-wiring): map the engine output onto these view-models.
 *   - SlipBatchResult (src/lib/slip/batch.ts) -> SlipReviewViewModel:
 *       result.unsure    -> questions   (BatchSlip.reason explains why)
 *       result.ready     -> ready       (direction expense|income; transfers need a question)
 *       result.duplicate -> duplicates  (BatchSlip.duplicateOf)
 *     item id = BatchSlip.clientRequestId (stable, idempotency-safe).
 *   - processSlipBatch onProgress({completed,total}) -> SlipReadingViewModel.
 *   - confidence = ParsedSlip.overallConfidence (0..1) — shown as a tiny bar, never as a number.
 */

export type SlipCategoryIcon = "food" | "go" | "home" | "shop" | "other" | "income";
export type SlipDirection = "expense" | "income";

export interface SlipCategoryOption {
  id: string;
  label: string;
  icon: SlipCategoryIcon;
  direction: SlipDirection;
}

// ---- Step 2: reading ---------------------------------------------------

export type SlipThumbStatus = "done" | "reading" | "waiting";

export interface SlipThumbVM {
  id: string;
  status: SlipThumbStatus;
  /** Decorative accent (bank colour). No slip image is ever kept or shown. */
  tint?: string;
  /** Short amount label drawn on a finished thumb, e.g. "1,290". */
  amountLabel?: string;
  /** Income thumbs print the amount in green. */
  direction?: SlipDirection;
}

export interface SlipRecentLineVM {
  id: string;
  title: string;
  categoryLabel: string;
  direction: SlipDirection;
  amountCents: number;
}

export interface SlipReadingViewModel {
  total: number;
  done: number;
  thumbs: SlipThumbVM[];
  /** Newest first; the component shows at most 3. */
  recent: SlipRecentLineVM[];
}

// ---- Step 3: review ----------------------------------------------------

export interface SlipReviewItemVM {
  id: string;
  title: string;
  /** Already formatted for display, e.g. "21 ต.ค.". */
  dateLabel: string;
  direction: SlipDirection;
  amountCents: number;
  categoryId: string | null;
  categoryLabel: string;
  icon: SlipCategoryIcon;
  /** 0..1, drawn as a small bar only. */
  confidence: number;
}

export interface SlipQuestionOptionVM {
  id: string;
  label: string;
  /** Optional small hint, e.g. "ทวงคืนได้". */
  hint?: string;
}

export interface SlipQuestionVM {
  id: string;
  /** "โอน" / "จ่าย" / "รับ" — the sentence is "<verb> ฿X <whoLabel> นี้คืออะไร?". */
  verb: string;
  amountCents: number;
  /** Full phrase after the amount, e.g. "ให้น้องเมย์". */
  whoLabel: string;
  /** e.g. "ธนาคารกสิกร · 19 ต.ค." */
  context: string;
  options: SlipQuestionOptionVM[];
  answeredOptionId?: string | null;
}

export interface SlipDuplicateVM {
  id: string;
  title: string;
  amountCents: number;
  direction: SlipDirection;
  dateLabel: string;
}

export interface SlipTotalVM {
  count: number;
  totalCents: number;
}

export interface SlipReviewViewModel {
  /** e.g. "ตุลาคม 2569". */
  monthLabel: string;
  /** Headline count, e.g. 12 -> "พบ 12 รายการ". */
  foundCount: number;
  expense: SlipTotalVM;
  income: SlipTotalVM;
  questions: SlipQuestionVM[];
  ready: SlipReviewItemVM[];
  duplicates: SlipDuplicateVM[];
  /** Categories offered in the tap-to-change chip, both directions. */
  categories: SlipCategoryOption[];
}

// ---- Step 4: saved -----------------------------------------------------

export interface SlipSavedViewModel {
  savedCount: number;
  duplicateCount: number;
  monthLabel: string;
  /** Month-to-date spend including this batch. */
  monthSpentCents: number;
  /** Portion of that spend contributed by this batch. */
  batchSpentCents: number;
  monthIncomeCents: number;
  monthLeftCents: number;
  /** Stacked bar; widths are percent (0..100). */
  segments: { id: string; percent: number; color?: string }[];
}

// ---- Step 5: monthly summary ------------------------------------------

export interface MonthlySpendItem {
  id: string;
  title: string;
  dateLabel: string;
  amountCents: number;
}

export interface MonthlySpendCategory {
  id: string;
  label: string;
  icon: SlipCategoryIcon;
  amountCents: number;
  /** Whole percent of the month's spend, computed by the caller. */
  percent: number;
  /** Optional bar colour; falls back to MONTHLY_SPEND_PALETTE by index. */
  color?: string;
  items?: MonthlySpendItem[];
}

/**
 * TODO(codex-wiring): MonthlySpendSummary needs a new server query that
 * aggregates this month's expense/income transactions by category (and the
 * previous month for `insight`). Home passes null until it exists.
 */
export interface MonthlySpendSummary {
  /** Card header, e.g. "ตุลาคม". */
  monthShortLabel: string;
  /** Detail header, e.g. "ตุลาคม 2569". */
  monthLabel: string;
  spentCents: number;
  incomeCents: number;
  leftCents: number;
  categories: MonthlySpendCategory[];
  /** One calm sentence, or null for none. */
  insight: string | null;
  canGoPrev: boolean;
  canGoNext: boolean;
}

export const MONTHLY_SPEND_PALETTE = ["#204d3d", "#2f8a5b", "#c9a15a", "#c46a5a", "#d9cdb0"] as const;

export function categoryColor(category: { color?: string }, index: number): string {
  return category.color ?? MONTHLY_SPEND_PALETTE[index % MONTHLY_SPEND_PALETTE.length];
}
