import "server-only";

import { getIncomeProfileSummary } from "@/features/income-profile/queries";
import { getIncomeTarget } from "@/features/income-target/queries";
import { getTopOpportunities, type RankedOpportunity } from "@/features/opportunities/queries";
import { getIncomeMissions, getTodayMission } from "@/features/income-missions/queries";
import { calculateIncomeGap, type IncomeGapResult } from "@/lib/financial/income-gap";
import { parseMoneyToCents } from "@/lib/financial/money";
import type { IncomeMission, IncomeSource } from "@/types/database";
import type { IncomeProfile } from "@/lib/financial/income-profile";

export interface EarnOverview {
  profile: IncomeProfile;
  sources: IncomeSource[];
  gap: IncomeGapResult;
  topOpportunity: RankedOpportunity | null;
  topOpportunityHasActiveMissions: boolean;
  todayMission: IncomeMission | null;
}

/** Single aggregator for the /earn dashboard — every figure is real, deterministic data; nothing here calls an LLM. */
export async function getEarnOverview(): Promise<EarnOverview> {
  const [{ profile, sources }, target, topOpportunities, todayMission, missions] = await Promise.all([
    getIncomeProfileSummary(),
    getIncomeTarget(),
    getTopOpportunities(1),
    getTodayMission(),
    getIncomeMissions(),
  ]);

  const gap = calculateIncomeGap({
    targetMonthlyIncomeCents:
      target?.target_monthly_income !== null && target?.target_monthly_income !== undefined
        ? parseMoneyToCents(target.target_monthly_income)
        : null,
    averageMonthlyIncomeCents: profile.averageMonthlyIncomeCents,
  });

  const topOpportunity = topOpportunities[0] ?? null;
  const topOpportunityHasActiveMissions = topOpportunity
    ? missions.some((m) => m.related_opportunity_id === topOpportunity.opportunity.id)
    : false;

  return {
    profile,
    sources,
    gap,
    topOpportunity,
    topOpportunityHasActiveMissions,
    todayMission,
  };
}
