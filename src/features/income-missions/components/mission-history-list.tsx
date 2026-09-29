"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardList, History } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/i18n/client";
import {
  filterIncomeMissions,
  getIncomeMissionFilterCounts,
  type IncomeMissionHistoryFilter,
} from "@/lib/financial/income-mission-history";
import type { IncomeMission } from "@/types/database";
import { MissionCard } from "./mission-card";

const FILTERS: IncomeMissionHistoryFilter[] = ["active", "completed", "all"];

export function MissionHistoryList({ missions }: { missions: IncomeMission[] }) {
  const { t } = useTranslation();
  const counts = getIncomeMissionFilterCounts(missions);
  const [filter, setFilter] = useState<IncomeMissionHistoryFilter>(
    counts.active === 0 && counts.completed > 0 ? "completed" : "active"
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl bg-secondary px-4 py-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <History className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="font-heading font-semibold">{t("earn.missions.historyTitle")}</p>
          <p className="text-xs text-muted-foreground">
            {t("earn.missions.historySummary")
              .replace("{active}", String(counts.active))
              .replace("{completed}", String(counts.completed))}
          </p>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as IncomeMissionHistoryFilter)}>
        <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl p-1">
          {FILTERS.map((item) => (
            <TabsTrigger key={item} value={item} className="min-h-9 rounded-lg px-2">
              <span className="truncate">{t(`earn.missions.filters.${item}`)}</span>
              <span className="rounded-full bg-foreground/8 px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
                {counts[item]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {FILTERS.map((item) => {
          const filtered = filterIncomeMissions(missions, item);
          return (
            <TabsContent key={item} value={item} className="mt-3">
              {filtered.length > 0 ? (
                <div className="grid gap-3">
                  {filtered.map((mission) => <MissionCard key={mission.id} mission={mission} />)}
                </div>
              ) : (
                <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border bg-card px-6 py-10 text-center shadow-card">
                  {item === "completed" ? (
                    <ClipboardList className="size-8 text-muted-foreground" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="size-8 text-primary" aria-hidden="true" />
                  )}
                  <p className="mt-3 font-heading font-semibold">
                    {t(item === "completed" ? "earn.missions.noCompletedTitle" : "earn.missions.noActiveTitle")}
                  </p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    {t(item === "completed" ? "earn.missions.noCompletedDescription" : "earn.missions.noActiveDescription")}
                  </p>
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
