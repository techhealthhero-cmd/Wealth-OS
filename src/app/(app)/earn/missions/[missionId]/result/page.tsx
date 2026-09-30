import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getUserSkills } from "@/features/skills/queries";
import { getMissionTemplate } from "@/lib/earn/mission-templates";
import type { IncomePathType } from "@/lib/earn/types";
import { MissionResultForm } from "@/features/earn/components/v2/mission-result-form";

export const metadata: Metadata = { title: "Earn — Wealth OS" };

export default async function MissionResultPage({ params }: { params: Promise<{ missionId: string }> }) {
  const { missionId } = await params;
  const supabase = await createClient();
  // RLS scopes both reads to the signed-in user.
  const { data: mission } = await supabase
    .from("income_missions")
    .select("id, title, income_path_id, roadmap_step_key")
    .eq("id", missionId)
    .maybeSingle();
  if (!mission?.income_path_id || !mission.roadmap_step_key) notFound();
  const { data: path } = await supabase.from("income_paths").select("id, path_type").eq("id", mission.income_path_id).maybeSingle();
  if (!path) notFound();
  const template = getMissionTemplate(path.path_type as IncomePathType, mission.roadmap_step_key);
  if (!template) notFound();
  const skills = await getUserSkills();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{mission.title}</p>
      <MissionResultForm
        missionId={mission.id}
        pathId={path.id}
        fields={template.resultFields}
        mayProduceIncome={template.mayProduceIncome}
        skills={skills.map((s) => ({ id: s.id, name: s.skill_name }))}
      />
    </div>
  );
}
