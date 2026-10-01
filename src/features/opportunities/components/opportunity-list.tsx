import Link from "next/link";

import { getProfile } from "@/features/profile/queries";
import { getEarnHubData } from "@/features/earn/v2-queries";
import { RecommendedExperimentCard } from "@/features/earn/components/v2/hub-cards";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Explainable experiments only. The old catalog looked like a marketplace
 * even though it contained no live jobs, so it no longer competes with the
 * user's guided path. */
export async function OpportunityList() {
  const [hub, profile] = await Promise.all([getEarnHubData(), getProfile()]);
  const dict = getDictionary(await getLocale(profile?.preferred_language));
  const copy = dict.earn.v2.opportunitiesV2;

  return (
    <section aria-labelledby="opps-for-you" className="mx-auto max-w-2xl space-y-3">
      <div>
        <h2 id="opps-for-you" className="text-lg font-bold">{copy.forYou}</h2>
        <p className="text-sm text-muted-foreground">{copy.forYouHint}</p>
      </div>
      {!hub.assessment ? (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <p className="text-sm text-muted-foreground">{copy.takeDiagnostic}</p>
            <Button className="h-11 w-full rounded-xl" nativeButton={false} render={<Link href="/earn/diagnostic" />}>
              {copy.startDiagnostic}
            </Button>
          </CardContent>
        </Card>
      ) : hub.recommendations.length ? (
        <div className="space-y-3">
          {hub.recommendations.slice(0, 3).map((experiment) => (
            <RecommendedExperimentCard key={experiment.key} dict={dict} experiment={experiment} />
          ))}
        </div>
      ) : (
        <Card><CardContent className="pt-5 text-sm text-muted-foreground">{dict.earn.v2.result.noExperiments}</CardContent></Card>
      )}
    </section>
  );
}
