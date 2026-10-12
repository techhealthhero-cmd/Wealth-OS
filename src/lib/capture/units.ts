/**
 * Shared helpers for counted units ("ดื่ม" = ฿200, migration 0044) — pure,
 * so the server action, the parser's caller and tests all agree.
 */
import { parseMoneyToCents } from "@/lib/financial/money";
import { normalizeText, type CaptureUnit } from "./transaction-parser";

/** How a unit word is stored and matched: trimmed, lowercased, single-spaced. */
export function normalizeUnitWord(word: string): string {
  return normalizeText(word).toLowerCase().slice(0, 40);
}

/**
 * Units capture reads: the user's saved units, plus per-unit income sources
 * from Earn for words not saved here (income, filed under `categoryId`). A
 * saved unit wins — it's the newer, capture-specific answer.
 */
export function mergeCaptureUnits(
  saved: CaptureUnit[],
  incomeSources: { unit_label: string; unit_rate: string | number }[],
  categoryId: string | null
): CaptureUnit[] {
  const out = [...saved];
  const fromIncome = toCaptureUnits(
    incomeSources.map((s) => ({
      unit_normalized: normalizeUnitWord(s.unit_label),
      unit_label: s.unit_label.trim(),
      unit_price: s.unit_rate,
      type: "income" as const,
      category_id: categoryId,
    }))
  );
  for (const unit of fromIncome) {
    if (unit.unit_normalized && !out.some((u) => u.unit_normalized === unit.unit_normalized)) out.push(unit);
  }
  return out;
}

/** A stored row → what the parser reads. Rows with an unreadable price are skipped. */
export function toCaptureUnits(
  rows: { unit_normalized: string; unit_label: string; unit_price: string | number; type: "income" | "expense"; category_id: string | null }[]
): CaptureUnit[] {
  const out: CaptureUnit[] = [];
  for (const row of rows) {
    let cents: number;
    try {
      cents = parseMoneyToCents(row.unit_price);
    } catch {
      continue;
    }
    if (cents <= 0) continue;
    out.push({
      unit_normalized: row.unit_normalized,
      unit_label: row.unit_label,
      unit_price_cents: cents,
      type: row.type,
      category_id: row.category_id,
    });
  }
  return out;
}
