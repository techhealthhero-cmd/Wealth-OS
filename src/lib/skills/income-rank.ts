import type { MissionType } from "@/types/database";

export const INCOME_MISSION_XP_REWARDS: Record<MissionType, number> = {
  define_offer: 10,
  build_portfolio: 15,
  set_price: 10,
  create_profile: 15,
  outreach: 15,
  follow_up: 10,
  publish_offer: 15,
  close_client: 40,
  list_product: 15,
  raise_price: 25,
  ask_referral: 30,
  other: 10,
};

export const INCOME_RANKS = [
  { rank: 1, minimumXp: 0, titleKey: "starter" },
  { rank: 2, minimumXp: 100, titleKey: "actionTaker" },
  { rank: 3, minimumXp: 250, titleKey: "jobGetter" },
  { rank: 4, minimumXp: 500, titleKey: "incomeBuilder" },
  { rank: 5, minimumXp: 900, titleKey: "professional" },
  { rank: 6, minimumXp: 1500, titleKey: "specialist" },
  { rank: 7, minimumXp: 2500, titleKey: "master" },
] as const;

export type IncomeRankTitleKey = (typeof INCOME_RANKS)[number]["titleKey"];

export interface IncomeRankProgress {
  rank: number;
  titleKey: IncomeRankTitleKey;
  totalXp: number;
  currentRankMinimumXp: number;
  nextRank: number | null;
  nextRankMinimumXp: number | null;
  xpIntoRank: number;
  xpForNextRank: number | null;
  xpToNextRank: number;
  progressPercent: number;
}

export interface IncomeRankBreakdownItem {
  missionType: MissionType;
  completedCount: number;
  xpEarned: number;
}

export function getIncomeMissionXpReward(missionType: MissionType): number {
  return INCOME_MISSION_XP_REWARDS[missionType];
}

export function calculateIncomeRank(totalXp: number): IncomeRankProgress {
  const safeXp = Math.max(0, Math.floor(totalXp));
  let currentIndex = 0;

  for (let index = 1; index < INCOME_RANKS.length; index += 1) {
    if (safeXp >= INCOME_RANKS[index].minimumXp) currentIndex = index;
    else break;
  }

  const current = INCOME_RANKS[currentIndex];
  const next = INCOME_RANKS[currentIndex + 1] ?? null;
  const xpIntoRank = safeXp - current.minimumXp;
  const xpForNextRank = next ? next.minimumXp - current.minimumXp : null;
  const progressPercent = xpForNextRank === null ? 100 : Math.min(100, Math.round((xpIntoRank / xpForNextRank) * 100));

  return {
    rank: current.rank,
    titleKey: current.titleKey,
    totalXp: safeXp,
    currentRankMinimumXp: current.minimumXp,
    nextRank: next?.rank ?? null,
    nextRankMinimumXp: next?.minimumXp ?? null,
    xpIntoRank,
    xpForNextRank,
    xpToNextRank: next ? next.minimumXp - safeXp : 0,
    progressPercent,
  };
}
