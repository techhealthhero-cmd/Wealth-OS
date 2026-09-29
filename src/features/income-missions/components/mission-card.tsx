"use client";

import { useTransition } from "react";
import { CheckCircle2 } from "lucide-react";

import type { IncomeMission } from "@/types/database";
import { updateMissionStatus, incrementMissionProgress } from "@/features/income-missions/actions";
import { useTranslation } from "@/i18n/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_BADGE_CLASS: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  skipped: "bg-muted text-muted-foreground line-through",
};

export function MissionCard({ mission }: { mission: IncomeMission }) {
  const { t, locale } = useTranslation();
  const [isPending, startTransition] = useTransition();

  const targetQuantity = mission.target_quantity !== null ? Number(mission.target_quantity) : null;
  const progressQuantity = Number(mission.progress_quantity);
  const isDone = mission.status === "completed" || mission.status === "skipped";

  return (
    <Card className={mission.status === "completed" ? "bg-emerald-50/45 ring-emerald-700/10 dark:bg-emerald-950/15" : undefined}>
      <CardContent className="space-y-2 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={`break-words font-medium ${mission.status === "skipped" ? "text-muted-foreground line-through" : ""}`}>
              {t(`earn.missions.templates.${mission.mission_type}.title`)}
            </p>
            <p className="mt-0.5 break-words text-sm text-muted-foreground">
              {t(`earn.missions.templates.${mission.mission_type}.description`)}
            </p>
          </div>
          <Badge className={cn("shrink-0", STATUS_BADGE_CLASS[mission.status])}>{t(`earn.missions.statuses.${mission.status}`)}</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {targetQuantity !== null ? (
            <span>
              {t("earn.missions.progress")}: {progressQuantity}/{targetQuantity}
            </span>
          ) : null}
          {mission.estimated_minutes !== null ? (
            <span>
              {t("earn.missions.estimatedTime")}: {mission.estimated_minutes} {t("earn.missions.estimatedMinutes")}
            </span>
          ) : null}
          <span>
            {t("earn.missions.impact")}: {t(`earn.missions.impactLevels.${mission.impact_level}`)}
          </span>
          {mission.status === "completed" ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              {t("earn.missions.completedOn").replace(
                "{date}",
                new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { dateStyle: "medium" }).format(new Date(mission.updated_at))
              )}
            </span>
          ) : null}
        </div>

        {!isDone ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {targetQuantity !== null ? (
              <Button
                size="sm"
                disabled={isPending}
                onClick={() => startTransition(async () => { await incrementMissionProgress(mission.id, targetQuantity); })}
              >
                {t("earn.missions.addProgress")}
              </Button>
            ) : mission.status === "not_started" ? (
              <Button
                size="sm"
                disabled={isPending}
                onClick={() => startTransition(async () => { await updateMissionStatus(mission.id, "in_progress"); })}
              >
                {t("earn.missions.markInProgress")}
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={isPending}
                onClick={() => startTransition(async () => { await updateMissionStatus(mission.id, "completed"); })}
              >
                {t("earn.missions.markCompleted")}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => startTransition(async () => { await updateMissionStatus(mission.id, "skipped"); })}
            >
              {t("earn.missions.markSkipped")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => startTransition(async () => { await updateMissionStatus(mission.id, "not_started"); })}
            >
              {t("earn.missions.undo")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
