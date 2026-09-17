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
import { ArrowRight } from "lucide-react";

function scoreClass(score: number): string {
  if (score >= 70) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400";
  if (score >= 40) return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

export function OpportunityCard({ ranked, hasActiveMissions }: { ranked: RankedOpportunity; hasActiveMissions: boolean }) {
  const { t, locale } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const { opportunity, score } = ranked;
  const name = locale === "th" ? opportunity.name_th : opportunity.name_en;
  const description = locale === "th" ? opportunity.description_th : opportunity.description_en;

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="break-words font-medium">{name}</p>
            <p className="mt-0.5 break-words text-sm text-muted-foreground">{description}</p>
          </div>
          <Badge className={cn("shrink-0", scoreClass(score.totalScore))}>{score.totalScore}/100</Badge>
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

        <p className="text-[11px] text-muted-foreground">{t("earn.opportunities.estimatedIncomeDisclaimer")}</p>

        {hasActiveMissions ? (
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/earn/missions" />}>
            {t("earn.opportunities.alreadyStarted")}
            <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await generateMissionsForOpportunity(opportunity.id);
              })
            }
          >
            {isPending ? t("common.saving") : t("earn.opportunities.startMissions")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
