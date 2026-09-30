"use client";

import { useTransition } from "react";
import Link from "next/link";

import type { RankedOpportunity } from "@/features/opportunities/queries";
import { generateMissionsForOpportunity } from "@/features/income-missions/actions";
import { useTranslation } from "@/i18n/client";
import { formatMoney, parseMoneyToCents } from "@/lib/financial/money";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { opportunityFit, opportunityPathType, opportunityReasons, smallExperimentFor, type OpportunityFit } from "@/lib/earn/opportunities";
import { ArrowRight } from "lucide-react";

// Earn V2: the deterministic score is shown as a plain label, never as "x/100".
const FIT_CLASS: Record<OpportunityFit, string> = {
  strong: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  worth_trying: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  later: "bg-muted text-muted-foreground",
};

export function OpportunityCard({ ranked, hasActiveMissions }: { ranked: RankedOpportunity; hasActiveMissions: boolean }) {
  const { t, locale } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const { opportunity, score } = ranked;
  const name = locale === "th" ? opportunity.name_th : opportunity.name_en;
  const description = locale === "th" ? opportunity.description_th : opportunity.description_en;
  const whyReasons = opportunityReasons({
    matchedSkillCount: score.matchedSkillCategories.length,
    timeToFirstIncome: opportunity.time_to_first_income,
    difficulty: opportunity.difficulty,
    startupCostMaxMinor: parseMoneyToCents(opportunity.estimated_startup_cost_max),
  });

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="break-words font-medium">{name}</p>
            <p className="mt-0.5 break-words text-sm text-muted-foreground">{description}</p>
          </div>
          <Badge className={cn("shrink-0", FIT_CLASS[opportunityFit(score.totalScore)])}>
            {t(`earn.v2.opportunitiesV2.fit.${opportunityFit(score.totalScore)}`)}
          </Badge>
        </div>

        {score.matchedSkillCategories.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("earn.opportunities.matchedSkills")}:{" "}
            {score.matchedSkillCategories.map((c) => t(`earn.skills.categories.${c}`)).join(", ")}
          </p>
        ) : null}

        {score.missingRequirements.length > 0 ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {score.missingRequirements.map((m) => t(`earn.opportunities.missingLabels.${m}`)).join(" · ")}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">{t("earn.opportunities.estimatedIncome")}</p>
            <p className="font-medium">
              {formatMoney(parseMoneyToCents(opportunity.estimated_monthly_income_min))}–
              {formatMoney(parseMoneyToCents(opportunity.estimated_monthly_income_max))}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("earn.opportunities.timeRequired")}</p>
            <p className="font-medium">
              {opportunity.estimated_hours_per_week_min}–{opportunity.estimated_hours_per_week_max}{" "}
              {t("earn.skills.hoursPerWeekUnit")}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("earn.opportunities.difficulty")}</p>
            <p className="font-medium">{t(`earn.opportunities.difficulties.${opportunity.difficulty}`)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("earn.opportunities.timeToFirstIncome")}</p>
            <p className="font-medium">{t(`earn.opportunities.speeds.${opportunity.time_to_first_income}`)}</p>
          </div>
        </div>

        {whyReasons.length > 0 ? (
          <div>
            <p className="text-xs font-medium">{t("earn.v2.opportunitiesV2.why")}</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {whyReasons.map((r) => (
                <li key={r} className="rounded-full bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary dark:text-[#7FD6B2]">
                  {t(`earn.v2.opportunitiesV2.reasons.${r}`)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rounded-2xl bg-muted/60 px-3 py-2.5">
          <p className="text-xs font-medium text-muted-foreground">{t("earn.v2.opportunitiesV2.smallTest")}</p>
          <p className="text-sm">{t(`earn.v2.opportunitiesV2.experiments.${smallExperimentFor(opportunity.income_model)}`)}</p>
        </div>

        <p className="text-[11px] text-muted-foreground">{t("earn.opportunities.estimatedIncomeDisclaimer")}</p>

        <Button
          className="h-11 w-full rounded-xl"
          nativeButton={false}
          render={<Link href={`/earn/paths/new?type=${opportunityPathType(opportunity.income_model)}&title=${encodeURIComponent(name)}`} />}
        >
          {t("earn.v2.opportunitiesV2.startPath")}
          <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
        </Button>

        {hasActiveMissions ? (
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/earn/missions" />}>
            {t("earn.opportunities.alreadyStarted")}
            <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="h-10"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await generateMissionsForOpportunity(opportunity.id);
              })
            }
          >
            {isPending ? t("common.saving") : t("earn.v2.opportunitiesV2.legacyStart")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
