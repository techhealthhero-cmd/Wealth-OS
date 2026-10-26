/**
 * How a calendar day is colored on Finance → รายการ (Variant B).
 * Display only: the day's net and spend already come from the shared
 * financial functions. Darker red means more spent; green means the day's
 * net is money in. `--spend` in CSS uses `spendMix` (32% lightest, 100% darkest).
 */

export interface DayHeatInput {
  netCents: number;
  spentCents: number;
}

export type DayHeat =
  | { kind: "empty" }
  | { kind: "income" }
  | { kind: "spend"; ratio: number };

export function dayTone(day: DayHeatInput, maxSpentCents: number): DayHeat {
  if (day.netCents > 0) return { kind: "income" };
  if (day.spentCents > 0 && maxSpentCents > 0) {
    return { kind: "spend", ratio: Math.min(1, day.spentCents / maxSpentCents) };
  }
  return { kind: "empty" };
}

/** 32% is the lightest spend, 100% the darkest. */
export function spendMix(ratio: number): number {
  const t = Math.min(1, Math.max(0, ratio));
  return Math.round(32 + t * 68);
}
