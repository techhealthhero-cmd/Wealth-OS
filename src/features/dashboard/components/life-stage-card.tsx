"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import type { LifeStageAndPriorities } from "@/features/life-stage/queries";
import { LIFE_STAGE_ORDER } from "@/lib/financial/life-stage";
import { useTranslation } from "@/i18n/client";
import { formatMoney } from "@/lib/financial/money";
import { FinancialStageProgress } from "@/components/illustrations";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function LifeStageCard({ data }: { data: LifeStageAndPriorities }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { lifeStage, topPriority } = data;
  const stageIndex1 = LIFE_STAGE_ORDER.indexOf(lifeStage.stage) + 1;

  return (
    <Card className="col-span-2">
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{t("dashboard2.lifeStage")}</p>
          <span className="text-lg font-bold">{t(`lifeStage.stages.${lifeStage.stage}`)}</span>
        </div>

        <FinancialStageProgress stage={stageIndex1} size={280} className="w-full" />

        {topPriority ? (
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">{t("dashboard2.topPriority")}</p>
            <p className="text-sm font-semibold">{t(`priorityEngine.priorities.${topPriority.priorityType}`)}</p>
            {topPriority.amountCents !== undefined ? (
              <p className="text-xs text-muted-foreground">{formatMoney(topPriority.amountCents)}</p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("priorityEngine.noPriorities")}</p>
        )}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs font-medium text-primary transition-transform duration-(--motion-fast) active:scale-[0.98]"
        >
          {t("lifeStage.whyThisStage")}
          <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
        </button>

        {expanded ? (
          <div className="animate-in fade-in slide-in-from-top-1 duration-(--motion-normal) space-y-2 border-t pt-2 text-xs">
            <p className="text-muted-foreground">{t(`lifeStage.criteria.${lifeStage.stage}`)}</p>
            {lifeStage.nextStage ? (
              <div>
                <p className="font-medium">
                  {t("lifeStage.nextStage")}: {t(`lifeStage.stages.${lifeStage.nextStage}`)}
                </p>
                <p className="text-muted-foreground">{t("lifeStage.requirementsForNextStage")}:</p>
                <ul className="list-inside list-disc text-muted-foreground">
                  {lifeStage.nextStageRequirements.map(() => (
                    <li key={lifeStage.nextStage}>{t(`lifeStage.criteria.${lifeStage.nextStage}`)}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="font-medium">{t("lifeStage.noNextStage")}</p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
