import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { getEmergencyFundMinor, getLatestAssessment } from "@/features/earn/v2-queries";
import { getProfile } from "@/features/profile/queries";
import { getAccountPrivacyState } from "@/features/account-privacy/queries";
import { isPrivacyLockedFor } from "@/features/account-privacy/types";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { calculateEarnStage } from "@/lib/earn/stage";
import { deriveStageFacts, mainConstraint } from "@/lib/earn/diagnostic";
import { recommendExperiments } from "@/lib/earn/recommendations";
import { formatMoney } from "@/lib/financial/money";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EarnSituationCard, RecommendedExperimentCard } from "@/features/earn/components/v2/hub-cards";

export const metadata: Metadata = { title: "Earn — Wealth OS" };

/** "จุดเริ่มต้นของคุณ" — plain-language starting point + explainable experiments. */
export default async function DiagnosticResultPage() {
  const [assessment, fundMinor, profile, privacy] = await Promise.all([
    getLatestAssessment(),
    getEmergencyFundMinor(),
    getProfile(),
    getAccountPrivacyState(),
  ]);
  if (!assessment) redirect("/earn/diagnostic");

  const dict = getDictionary(await getLocale(profile?.preferred_language));
  const v2 = dict.earn.v2;
  const a = assessment.answers;
  const stage = calculateEarnStage(deriveStageFacts(a, fundMinor));
  const experiments = recommendExperiments(a, stage.stage);
  const constraint = mainConstraint(a, stage.stage);
  const hidden = isPrivacyLockedFor(privacy, "planning");
  const steps = v2.diagnostic.steps;

  const rows: { label: string; value: string }[] = [
    { label: v2.result.income, value: hidden ? "••••" : formatMoney(a.monthlyIncomeMinor, a.startingCapitalCurrency) },
    { label: v2.result.expenses, value: hidden ? "••••" : formatMoney(a.essentialExpensesMinor, a.startingCapitalCurrency) },
    {
      label: v2.result.resources,
      value: a.availableResources.length ? a.availableResources.map((r) => steps.resources.options[r]).join(", ") : "—",
    },
    {
      label: v2.result.strengths,
      value: [
        ...a.existingAbilities.filter((x) => x !== "none").map((x) => steps.abilities.options[x]),
        ...a.workPreferences.filter((x) => x !== "not_sure").map((x) => steps.preferences.options[x]),
      ].join(", ") || "—",
    },
    { label: v2.result.constraint, value: v2.result.constraints[constraint] },
    { label: v2.result.priority, value: steps.priority.options[a.currentPriority] },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{v2.result.title}</h2>
      <EarnSituationCard dict={dict} stage={stage} />

      <Card>
        <CardContent className="pt-5">
          <dl className="divide-y">
            {rows.map((r) => (
              <div key={r.label} className="flex items-start justify-between gap-4 py-2.5 text-sm">
                <dt className="shrink-0 text-muted-foreground">{r.label}</dt>
                <dd className="text-right font-medium text-pretty">{r.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">{v2.result.selfReported}</p>
        </CardContent>
      </Card>

      <section aria-labelledby="experiments" className="space-y-2">
        <div>
          <h3 id="experiments" className="text-base font-semibold">
            {v2.result.experimentsTitle}
          </h3>
          <p className="text-sm text-muted-foreground">{v2.result.experimentsHint}</p>
        </div>
        {experiments.length > 0 ? (
          experiments.map((e) => <RecommendedExperimentCard key={e.key} dict={dict} experiment={e} />)
        ) : (
          <Card>
            <CardContent className="pt-5 text-sm text-muted-foreground">{v2.result.noExperiments}</CardContent>
          </Card>
        )}
      </section>

      <Button variant="outline" className="h-12 w-full rounded-2xl" nativeButton={false} render={<Link href="/earn/paths/new" />}>
        {v2.result.allPaths}
        <ArrowRight className="ml-1 size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
