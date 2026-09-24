import { getRankedOpportunities } from "@/features/opportunities/queries";
import { getIncomeMissions } from "@/features/income-missions/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { OpportunityCard } from "./opportunity-card";
import { EmptyState } from "@/components/shared/empty-state";
import { EarnIllustration } from "@/components/illustrations";
import { getFeatureLimit } from "@/lib/billing/entitlements";
import { LockedFeatureCard } from "@/features/billing/components/locked-feature-card";
import { trackEvent } from "@/lib/analytics";

export async function OpportunityList() {
  const [ranked, missions, profile, opportunitiesMax] = await Promise.all([
    getRankedOpportunities(),
    getIncomeMissions(),
    getProfile(),
    getFeatureLimit("incomeOpportunitiesMax"),
  ]);
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
  const visible = opportunitiesMax !== null ? ranked.slice(0, opportunitiesMax) : ranked;
  const hiddenCount = ranked.length - visible.length;

  // No existing "opportunity viewed" state to check against — reuses the
  // already-fetched `missions` list as a proxy (same "an already-computed
  // adjacent value is a reasonable proxy for a true first-time" pattern
  // /api/ai/chat/route.ts uses for first_ai_message_sent): a user with zero
  // income missions anywhere has, in practice, never meaningfully engaged
  // with an opportunity before, since starting a mission is the natural
  // next action after viewing one.
  if (profile && missions.length === 0) trackEvent("first_income_opportunity_viewed", profile.user_id);

  return (
    <div className="grid gap-3">
      {visible.map((r) => (
        <OpportunityCard key={r.opportunity.id} ranked={r} hasActiveMissions={opportunityIdsWithMissions.has(r.opportunity.id)} />
      ))}
      {hiddenCount > 0 ? (
        <LockedFeatureCard
          title={dict.billing.locked.moreOpportunitiesTitle}
          description={dict.billing.locked.moreOpportunitiesDescription.replace("{count}", String(hiddenCount))}
          ctaLabel={dict.billing.upgradeCta}
        />
      ) : null}
    </div>
  );
}
