/**
 * Milestones (2026-10-15) — the seven "firsts" shown as hand-drawn stickers
 * on the Missions page. Deterministic and read-only: each one is decided
 * from data already recorded elsewhere, never stored or awarded on its own,
 * so it can't drift out of sync with what actually happened. Celebration is
 * deliberately quiet (a sticker lights up), never a modal or confetti.
 */

export const MILESTONE_KEYS = [
  "first-transaction",
  "first-budget",
  "emergency-fund-started",
  "goal-reached",
  "first-debt-paid",
  "first-side-income",
  "saving-streak-7",
] as const;

export type MilestoneKey = (typeof MILESTONE_KEYS)[number];

export interface MilestoneInputs {
  transactionCount: number;
  hasBudget: boolean;
  emergencyFundCurrentCents: number;
  /** Every non-archived goal's saved vs. target amount, plus whether it's marked completed. */
  goals: { currentCents: number; targetCents: number; completed: boolean }[];
  liabilityBalancesCents: number[];
  /** `source_type` of every active income source. */
  activeIncomeSourceTypes: string[];
  /** Days with at least one recorded transaction (any order, duplicates fine). */
  transactionDates: Date[];
}

/** Income that is extra on top of a main job — salary and bonus are not side income. */
const SIDE_INCOME_TYPES = new Set(["freelance", "business", "commission", "side_hustle", "rental"]);

const STREAK_DAYS = 7;

function dayNumber(date: Date): number {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

/** Longest run of consecutive calendar days among `dates`. */
export function longestDailyRun(dates: Date[]): number {
  const days = [...new Set(dates.map(dayNumber))].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && days[i] === days[i - 1] + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  return longest;
}

export function calculateMilestones(inputs: MilestoneInputs): Record<MilestoneKey, boolean> {
  return {
    "first-transaction": inputs.transactionCount > 0,
    "first-budget": inputs.hasBudget,
    "emergency-fund-started": inputs.emergencyFundCurrentCents > 0,
    "goal-reached": inputs.goals.some((g) => g.completed || (g.targetCents > 0 && g.currentCents >= g.targetCents)),
    "first-debt-paid": inputs.liabilityBalancesCents.some((b) => b <= 0),
    "first-side-income": inputs.activeIncomeSourceTypes.some((t) => SIDE_INCOME_TYPES.has(t)),
    "saving-streak-7": longestDailyRun(inputs.transactionDates) >= STREAK_DAYS,
  };
}
