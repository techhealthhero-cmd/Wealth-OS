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
import Link from "next/link";
import { getEarnHubData } from "@/features/earn/v2-queries";
import { RecommendedExperimentCard } from "@/features/earn/components/v2/hub-cards";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Dictionary } from "@/i18n/dictionaries";

/** Earn V2: explainable experiments from the user's own diagnostic, above the curated catalog. */
async function ForYouSection({ dict }: { dict: Dictionary }) {
  const hub = await getEarnHubData();
  const copy = dict.earn.v2.opportunitiesV2;
  return (
    <section aria-labelledby="opps-for-you" className="space-y-2">
      <div>
        <h2 id="opps-for-you" className="text-base font-semibold">
          {copy.forYou}
        </h2>
        {hub.assessment ? (
          <p className="text-sm text-muted-foreground">{copy.forYouHint}</p>
        ) : null}
      </div>
      {!hub.assessment ? (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {copy.takeDiagnostic}
            </p>
            <Button
              className="h-11 shrink-0 rounded-xl"
              nativeButton={false}
              render={<Link href="/earn/diagnostic" />}
            >
              {copy.startDiagnostic}
            </Button>
          </CardContent>
        </Card>
      ) : hub.recommendations.length ? (
        hub.recommendations.map((e) => (
          <RecommendedExperimentCard key={e.key} dict={dict} experiment={e} />
        ))
      ) : (
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">
            {dict.earn.v2.result.noExperiments}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

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
      <div className="space-y-4">
        <ForYouSection dict={dict} />
        <EmptyState
          illustration={<EarnIllustration size={140} />}
          title={dict.earn.opportunities.emptyTitle}
          description={dict.earn.opportunities.emptyState}
        />
      </div>
    );
  }

  const opportunityIdsWithMissions = new Set(
    missions.map((m) => m.related_opportunity_id).filter(Boolean),
  );
  const visible =
    opportunitiesMax !== null ? ranked.slice(0, opportunitiesMax) : ranked;
  const hiddenCount = ranked.length - visible.length;

  // No existing "opportunity viewed" state to check against — reuses the
  // already-fetched `missions` list as a proxy (same "an already-computed
  // adjacent value is a reasonable proxy for a true first-time" pattern
  // /api/ai/chat/route.ts uses for first_ai_message_sent): a user with zero
  // income missions anywhere has, in practice, never meaningfully engaged
  // with an opportunity before, since starting a mission is the natural
  // next action after viewing one.
  if (profile && missions.length === 0)
    trackEvent("first_income_opportunity_viewed", profile.user_id);

  return (
    <div className="space-y-5">
      <ForYouSection dict={dict} />
      <section aria-labelledby="opps-catalog" className="space-y-2">
        <div>
          <h2 id="opps-catalog" className="text-base font-semibold">
            {dict.earn.v2.opportunitiesV2.catalog}
          </h2>
          <p className="text-sm text-muted-foreground">
            {dict.earn.v2.opportunitiesV2.catalogHint}
          </p>
        </div>
        <div className="grid gap-3">
          {visible.map((r) => (
            <OpportunityCard
              key={r.opportunity.id}
              ranked={r}
              hasActiveMissions={opportunityIdsWithMissions.has(
                r.opportunity.id,
              )}
            />
          ))}
          {hiddenCount > 0 ? (
            <LockedFeatureCard
              title={dict.billing.locked.moreOpportunitiesTitle}
              description={dict.billing.locked.moreOpportunitiesDescription.replace(
                "{count}",
                String(hiddenCount),
              )}
              ctaLabel={dict.billing.upgradeCta}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
