import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getUserSkills } from "@/features/skills/queries";
import { getSkillEvidenceData } from "@/features/earn/v2-queries";
import { getMissionTemplate } from "@/lib/earn/mission-templates";
import type { IncomePathType } from "@/lib/earn/types";
import { MissionResultForm } from "@/features/earn/components/v2/mission-result-form";
import { localizeMission } from "@/features/earn/components/v2/helpers";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { throwDbError } from "@/lib/db-error";

export const metadata: Metadata = { title: "Earn — Wealth OS" };

export default async function MissionResultPage({ params }: { params: Promise<{ missionId: string }> }) {
  const { missionId } = await params;
  const supabase = await createClient();
  // RLS scopes every read to the signed-in user. Skills, profile and the
  // saved result only need the mission id from the URL, so they load
  // alongside the mission instead of after it and its path.
  const [{ data: mission, error: missionError }, skills, skillData, profile, resultResponse] = await Promise.all([
    supabase
      .from("income_missions")
      .select("id, title, description, income_path_id, roadmap_step_key")
      .eq("id", missionId)
      .maybeSingle(),
    getUserSkills(),
    getSkillEvidenceData(),
    getProfile(),
    supabase.from("income_mission_results").select("outcome_data, notes").eq("income_mission_id", missionId).maybeSingle(),
  ]);
  if (missionError && missionError.code !== "22P02") throwDbError(missionError, "earn.missionResult.mission", "Failed to load mission result");
  if (!mission?.income_path_id || !mission.roadmap_step_key) notFound();
  const { data: path, error: pathError } = await supabase.from("income_paths").select("id, path_type").eq("id", mission.income_path_id).maybeSingle();
  if (pathError) throwDbError(pathError, "earn.missionResult.path", "Failed to load mission path");
  if (!path) notFound();
  const template = getMissionTemplate(path.path_type as IncomePathType, mission.roadmap_step_key);
  if (!template) notFound();
  const dict = getDictionary(await getLocale(profile?.preferred_language));
  // Skills linked to this path are offered first and pre-selected, so a result
  // becomes skill evidence without extra taps (the user can still pick "none").
  const linked = new Set(skillData.skillsByPath[path.id] ?? []);
  const ordered = [...skills].sort((a, b) => Number(linked.has(b.id)) - Number(linked.has(a.id)));
  const outcome = (resultResponse.data?.outcome_data ?? {}) as { counts?: Record<string, number>; answers?: Record<string, string> };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{localizeMission(dict, path.path_type, mission).title}</p>
      <MissionResultForm
        missionId={mission.id}
        pathId={path.id}
        fields={template.resultFields}
        answerFields={template.answerFields}
        resultKind={template.resultKind}
        targetQuantity={template.targetQuantity}
        mayProduceIncome={template.mayProduceIncome}
        skills={ordered.map((s) => ({ id: s.id, name: s.skill_name }))}
        defaultSkillId={ordered.find((s) => linked.has(s.id))?.id ?? null}
        initialCounts={outcome.counts}
        initialAnswers={outcome.answers}
        initialNotes={resultResponse.data?.notes ?? ""}
      />
    </div>
  );
}
