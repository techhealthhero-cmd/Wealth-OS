/**
 * XP / Progression — deterministic, secondary to real financial outcomes.
 * Total XP is never stored as its own counter; it is always the sum of the
 * append-only `xp_events` ledger (src/features/engagement/*), so it can
 * never drift out of sync with what actually happened.
 *
 * Rewards only meaningful financial actions (CLAUDE.md Day 6 spec) — never
 * spending, app-opening, or risky activity. Kept deliberately small and
 * flat (no exponential grind, no loot-box feel) — this is a progress
 * indicator, not a game economy.
 */

import type { XPEventType } from "@/types/database";

export const XP_REWARDS: Record<XPEventType, number> = {
  first_budget_created: 50,
  mission_completed: 20,
  income_mission_completed: 20,
  monthly_review_completed: 30,
  goal_milestone: 25,
  emergency_fund_milestone: 25,
  debt_milestone: 25,
};

export function getXpReward(eventType: XPEventType): number {
  return XP_REWARDS[eventType];
}

export function calculateTotalXp(events: { xpAmount: number }[]): number {
  return events.reduce((total, e) => total + e.xpAmount, 0);
}

/** Level thresholds — flat, small, and finite (caps at level 8) rather than an ever-scaling grind. */
const LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 4000, 8000];

export interface LevelProgress {
  level: number;
  totalXp: number;
  xpIntoLevel: number;
  /** null once the max level is reached. */
  xpForNextLevel: number | null;
  progressPercent: number;
}

export function calculateLevel(totalXp: number): LevelProgress {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (totalXp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }

  const currentThreshold = LEVEL_THRESHOLDS[level - 1];
  const nextThreshold = LEVEL_THRESHOLDS[level] ?? null;
  const xpIntoLevel = totalXp - currentThreshold;
  const xpForNextLevel = nextThreshold !== null ? nextThreshold - currentThreshold : null;
  const progressPercent = xpForNextLevel !== null ? Math.min(100, (xpIntoLevel / xpForNextLevel) * 100) : 100;

  return { level, totalXp, xpIntoLevel, xpForNextLevel, progressPercent };
}
