/**
 * Opportunity Ranking — deterministic Side Hustle Finder scoring. The model
 * never calls an LLM; AI may only explain an already-computed score
 * afterward (Day 5 STEP 8/13).
 *
 * Weights (sum to 100):
 *   Skill Match              30
 *   Available Time Match     20
 *   Income Gap Fit           20
 *   Startup Cost Fit         10
 *   Speed to First Income    10
 *   User Interest            10
 */

export type ProficiencyLevel = "beginner" | "intermediate" | "advanced" | "expert";
export type SkillCategory = string;
export type InterestLevel = "low" | "medium" | "high";
export type TimeToFirstIncome = "fast" | "medium" | "slow";

export interface OpportunityScoringSkill {
  category: SkillCategory;
  proficiencyLevel: ProficiencyLevel;
  interestLevel: InterestLevel;
}

export interface OpportunityScoringInput {
  requiredSkillCategories: SkillCategory[];
  recommendedProficiency: ProficiencyLevel;
  estimatedStartupCostMinCents: number;
  estimatedHoursPerWeekMin: number;
  timeToFirstIncome: TimeToFirstIncome;
  estimatedMonthlyIncomeMaxCents: number;
}

export interface OpportunityScoringContext {
  skills: OpportunityScoringSkill[];
  /** The user's stated weekly capacity. Null = unknown (not yet set). */
  maxHoursPerWeek: number | null;
  /** The current Income Gap, in cents. Null = no target set / not applicable. 0 = target already met. */
  incomeGapCents: number | null;
  /** The user's stated startup budget ceiling, in cents. Null = no preference stated. */
  maxStartupCostCents: number | null;
}

export type MissingRequirement = "skill" | "time" | "budget";

export interface OpportunityScoreBreakdown {
  skillMatch: number;
  availableTime: number;
  incomeGapFit: number;
  startupCostFit: number;
  speedToFirstIncome: number;
  userInterest: number;
}

export interface OpportunityScoreResult {
  totalScore: number;
  breakdown: OpportunityScoreBreakdown;
  matchedSkillCategories: SkillCategory[];
  missingRequirements: MissingRequirement[];
}

const WEIGHTS = {
  skillMatch: 30,
  availableTime: 20,
  incomeGapFit: 20,
  startupCostFit: 10,
  speedToFirstIncome: 10,
  userInterest: 10,
} as const;

const PROFICIENCY_RANK: Record<ProficiencyLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

const INTEREST_SCORE: Record<InterestLevel, number> = { high: 1, medium: 0.6, low: 0.3 };
const SPEED_SCORE: Record<TimeToFirstIncome, number> = { fast: 1, medium: 0.6, slow: 0.3 };

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function scoreOpportunity(
  opportunity: OpportunityScoringInput,
  context: OpportunityScoringContext
): OpportunityScoreResult {
  const matchedSkills = context.skills.filter((s) => opportunity.requiredSkillCategories.includes(s.category));
  const matchedSkillCategories = Array.from(new Set(matchedSkills.map((s) => s.category)));
  const missingRequirements: MissingRequirement[] = [];

  // --- Skill Match ---
  let skillMatch = 0;
  if (matchedSkills.length === 0) {
    missingRequirements.push("skill");
  } else {
    const recommendedRank = PROFICIENCY_RANK[opportunity.recommendedProficiency];
    const bestRank = Math.max(...matchedSkills.map((s) => PROFICIENCY_RANK[s.proficiencyLevel]));
    const ratio = clamp01(bestRank / recommendedRank);
    // Having the right skill category at all is worth half credit; reaching
    // (or exceeding) the recommended proficiency earns the rest.
    skillMatch = WEIGHTS.skillMatch * (0.5 + 0.5 * ratio);
    if (bestRank < recommendedRank) missingRequirements.push("skill");
  }

  // --- Available Time Match ---
  let availableTime: number;
  if (context.maxHoursPerWeek === null) {
    availableTime = WEIGHTS.availableTime * 0.5; // unknown — neutral, not penalized
  } else if (context.maxHoursPerWeek <= 0) {
    availableTime = 0;
    missingRequirements.push("time");
  } else if (opportunity.estimatedHoursPerWeekMin <= 0) {
    availableTime = WEIGHTS.availableTime;
  } else {
    const ratio = clamp01(context.maxHoursPerWeek / opportunity.estimatedHoursPerWeekMin);
    availableTime = WEIGHTS.availableTime * ratio;
    if (ratio < 1) missingRequirements.push("time");
  }

  // --- Income Gap Fit ---
  let incomeGapFit: number;
  if (context.incomeGapCents === null || context.incomeGapCents <= 0) {
    // No target, or already achieved — still broadly useful, so a neutral
    // (not zero, not full) score rather than treating it as irrelevant.
    incomeGapFit = WEIGHTS.incomeGapFit * 0.5;
  } else {
    const ratio = clamp01(opportunity.estimatedMonthlyIncomeMaxCents / context.incomeGapCents);
    incomeGapFit = WEIGHTS.incomeGapFit * ratio;
  }

  // --- Startup Cost Fit ---
  let startupCostFit: number;
  if (context.maxStartupCostCents === null) {
    startupCostFit = WEIGHTS.startupCostFit; // no stated ceiling — don't penalize
  } else if (opportunity.estimatedStartupCostMinCents <= context.maxStartupCostCents) {
    startupCostFit = WEIGHTS.startupCostFit;
  } else if (context.maxStartupCostCents <= 0) {
    startupCostFit = 0;
    missingRequirements.push("budget");
  } else {
    const ratio = clamp01(context.maxStartupCostCents / opportunity.estimatedStartupCostMinCents);
    startupCostFit = WEIGHTS.startupCostFit * ratio;
    missingRequirements.push("budget");
  }

  // --- Speed to First Income ---
  const speedToFirstIncome = WEIGHTS.speedToFirstIncome * SPEED_SCORE[opportunity.timeToFirstIncome];

  // --- User Interest ---
  const bestInterest = matchedSkills.reduce<number>((best, s) => Math.max(best, INTEREST_SCORE[s.interestLevel]), 0);
  const userInterest = WEIGHTS.userInterest * bestInterest;

  const breakdown: OpportunityScoreBreakdown = {
    skillMatch,
    availableTime,
    incomeGapFit,
    startupCostFit,
    speedToFirstIncome,
    userInterest,
  };

  const totalScore = Math.round(
    breakdown.skillMatch +
      breakdown.availableTime +
      breakdown.incomeGapFit +
      breakdown.startupCostFit +
      breakdown.speedToFirstIncome +
      breakdown.userInterest
  );

  return {
    totalScore,
    breakdown,
    matchedSkillCategories,
    missingRequirements: Array.from(new Set(missingRequirements)),
  };
}
