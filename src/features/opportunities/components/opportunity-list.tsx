import { getRankedOpportunities } from "@/features/opportunities/queries";
import { getIncomeMissions } from "@/features/income-missions/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { OpportunityCard } from "./opportunity-card";
import { EmptyState } from "@/components/shared/empty-state";
import { EarnIllustration } from "@/components/illustrations";

export async function OpportunityList() {
  const [ranked, missions, profile] = await Promise.all([getRankedOpportunities(), getIncomeMissions(), getProfile()]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  if (ranked.length === 0) {
    return (
      <EmptyState
        illustration={<EarnIllustration size={140} />}
        title={dict.earn.opportunities.emptyTitle}
        description={dict.earn.opportunities.emptyState}
      />
    );
  }

  const opportunityIdsWithMissions = new Set(missions.map((m) => m.related_opportunity_id).filter(Boolean));

  return (
    <div className="grid gap-3">
      {ranked.map((r) => (
        <OpportunityCard key={r.opportunity.id} ranked={r} hasActiveMissions={opportunityIdsWithMissions.has(r.opportunity.id)} />
      ))}
    </div>
  );
}
