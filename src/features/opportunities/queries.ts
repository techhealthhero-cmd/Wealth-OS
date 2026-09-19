import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getUserSkills } from "@/features/skills/queries";
import { getIncomeTarget } from "@/features/income-target/queries";
import { getIncomeProfileSummary } from "@/features/income-profile/queries";
import { calculateIncomeGap } from "@/lib/financial/income-gap";
import { scoreOpportunity, type OpportunityScoreResult } from "@/lib/financial/opportunity-scoring";
import { generateMissionSequence } from "@/lib/financial/income-missions";
import { parseMoneyToCents } from "@/lib/financial/money";
import type { IncomeOpportunity } from "@/types/database";
import { throwDbError } from "@/lib/db-error";

export async function getOpportunityCatalog(): Promise<IncomeOpportunity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("income_opportunities").select("*").order("name_th", { ascending: true });
  if (error) throwDbError(error, "opportunities.getOpportunityCatalog", "Failed to load opportunity catalog");
  return data ?? [];
}

export interface RankedOpportunity {
  opportunity: IncomeOpportunity;
  score: OpportunityScoreResult;
  firstRecommendedStep: string;
}

/**
 * Deterministic Side Hustle Finder ranking (Day 5 STEP 6/8). Every input is
 * real user data (skills, target, income profile); the ranking math itself
 * never calls an LLM — see src/lib/financial/opportunity-scoring.ts.
 */
export async function getRankedOpportunities(): Promise<RankedOpportunity[]> {
  const [catalog, skills, target, { profile }] = await Promise.all([
    getOpportunityCatalog(),
    getUserSkills(),
    getIncomeTarget(),
    getIncomeProfileSummary(),
  ]);

  const gap = calculateIncomeGap({
    targetMonthlyIncomeCents: target?.target_monthly_income !== null && target?.target_monthly_income !== undefined
      ? parseMoneyToCents(target.target_monthly_income)
      : null,
    averageMonthlyIncomeCents: profile.averageMonthlyIncomeCents,
  });

  const context = {
    skills: skills.map((s) => ({
      category: s.category,
      proficiencyLevel: s.proficiency_level,
      interestLevel: s.interest_level,
    })),
    maxHoursPerWeek: target?.max_hours_per_week !== null && target?.max_hours_per_week !== undefined ? Number(target.max_hours_per_week) : null,
    incomeGapCents: gap.hasTarget ? gap.gapCents : null,
    maxStartupCostCents: target?.max_startup_cost !== null && target?.max_startup_cost !== undefined ? parseMoneyToCents(target.max_startup_cost) : null,
  };

  const firstStepType = generateMissionSequence()[0]?.missionType ?? "define_offer";

  const ranked = catalog.map((opportunity) => {
    const score = scoreOpportunity(
      {
        requiredSkillCategories: opportunity.required_skill_categories,
        recommendedProficiency: opportunity.recommended_proficiency,
        estimatedStartupCostMinCents: parseMoneyToCents(opportunity.estimated_startup_cost_min),
        estimatedHoursPerWeekMin: Number(opportunity.estimated_hours_per_week_min),
        timeToFirstIncome: opportunity.time_to_first_income,
        estimatedMonthlyIncomeMaxCents: parseMoneyToCents(opportunity.estimated_monthly_income_max),
      },
      context
    );
    return { opportunity, score, firstRecommendedStep: firstStepType };
  });

  return ranked.sort((a, b) => b.score.totalScore - a.score.totalScore);
}

export async function getTopOpportunities(limit = 3): Promise<RankedOpportunity[]> {
  const ranked = await getRankedOpportunities();
  return ranked.slice(0, limit);
}
