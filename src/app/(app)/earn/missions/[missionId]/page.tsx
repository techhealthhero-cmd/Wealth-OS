import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList, Clock, Route, Target } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getIncomePath, getPathMissions } from "@/features/earn/v2-queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { throwDbError } from "@/lib/db-error";
import { getMissionTemplate } from "@/lib/earn/mission-templates";
import type { IncomePathType } from "@/lib/earn/types";
import { Card, CardContent } from "@/components/ui/card";
import { MissionActions } from "@/features/earn/components/v2/path-client";
import { fill, localizeMission, tr } from "@/features/earn/components/v2/helpers";

export const metadata: Metadata = { title: "Missions — Wealth OS" };

/**
 * One Earn V2 mission: what to do, why (its roadmap step on its path), how
 * long, and what result it needs. Completion uses the same V2 action as the
 * path page — there is no second way to finish a path mission.
 */
export default async function EarnMissionDetailPage({ params }: { params: Promise<{ missionId: string }> }) {
  const { missionId } = await params;
  const supabase = await createClient();
  // RLS scopes this to the signed-in user; another user's id is simply "not found".
  const [{ data: ref, error }, profile] = await Promise.all([
    supabase.from("income_missions").select("id, income_path_id").eq("id", missionId).maybeSingle(),
    getProfile(),
  ]);
  if (error && error.code !== "22P02") throwDbError(error, "earn.missionDetail", "Failed to load mission");
  if (!ref) notFound();
  const dict = getDictionary(await getLocale(profile?.preferred_language));
  const copy = dict.earn.v2.missionsV2;

  // Legacy missions have no path; they're managed in the classic list.
  if (!ref.income_path_id) {
    return (
      <Card>
        <CardContent className="space-y-3 pt-5 text-sm">
          <p>{copy.legacyMission}</p>
          <Link href="/earn/missions" className="inline-flex min-h-11 items-center font-medium text-primary dark:text-[#7FD6B2]">
            {dict.earn.v2.missions.title}
          </Link>
        </CardContent>
      </Card>
    );
  }

  const path = await getIncomePath(ref.income_path_id);
  if (!path) notFound();
  const mission = (await getPathMissions([path.id])).find((m) => m.id === missionId);
  if (!mission) notFound();

  const type = path.path_type as IncomePathType;
  const template = mission.roadmap_step_key ? getMissionTemplate(type, mission.roadmap_step_key) : null;
  const text = localizeMission(dict, type, mission);
  const stepName = mission.roadmap_step_key ? tr(dict, `earn.v2.roadmap.${type}.${mission.roadmap_step_key}`) : null;
  const fields = template?.resultFields ?? [];

  return (
    <div className="space-y-4">
      <Link href={`/earn/paths/${path.id}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary dark:text-[#7FD6B2]">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {copy.openPath}
      </Link>

      <Card className="border-primary/20">
        <CardContent className="space-y-4 pt-5">
          <div>
            <h2 className="text-lg font-bold leading-snug text-balance">{text.title}</h2>
            {text.description ? <p className="mt-1 text-sm text-muted-foreground">{text.description}</p> : null}
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2.5 py-1">
              <Route className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {copy.inPath}: {path.title}
              </span>
            </span>
            {mission.estimated_minutes ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                <Clock className="size-3.5" aria-hidden="true" />
                {fill(dict.earn.v2.missions.minutes, { n: mission.estimated_minutes })}
              </span>
            ) : null}
            {mission.target_quantity ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                <Target className="size-3.5" aria-hidden="true" />
                {fill(dict.earn.v2.missions.target, { n: Number(mission.target_quantity) })}
              </span>
            ) : null}
          </div>

          {stepName ? (
            <div className="rounded-2xl bg-muted/60 px-3 py-2.5">
              <p className="text-xs font-semibold">{copy.why}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{fill(copy.whyBody, { step: stepName, path: path.title })}</p>
            </div>
          ) : null}

          <div className="rounded-2xl bg-muted/60 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <ClipboardList className="size-3.5" aria-hidden="true" />
              {mission.result_required ? copy.recordAfter : copy.noResultNeeded}
            </p>
            {mission.result_required && fields.length ? (
              <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
                {fields.map((f) => (
                  <li key={f}>{tr(dict, `earn.v2.missions.result.fields.${f}`)}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <MissionActions missionId={mission.id} status={mission.status} resultRequired={mission.result_required} hasResult={mission.hasResult} />
        </CardContent>
      </Card>
    </div>
  );
}
