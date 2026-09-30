import Link from "next/link";

import { getSkillEvidenceData } from "@/features/earn/v2-queries";
import { EMPTY_SKILL_EVIDENCE, summarizeSkillEvidence, type SkillEvidenceLevel } from "@/lib/earn/skill-evidence";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/i18n/dictionaries";
import type { UserSkill } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { LogLearningButton } from "./skill-evidence-client";

const LEVEL_STYLE: Record<SkillEvidenceLevel, string> = {
  none: "bg-muted text-muted-foreground",
  learning: "bg-sky-500/10 text-sky-800 dark:text-sky-300",
  action: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
  outcome: "bg-primary/10 text-primary",
};

/**
 * Skills V2: each skill's progress as real evidence (learning / action /
 * outcome) and the income paths it supports. Rank/XP stay below as
 * motivation only — they never decide this level.
 */
export async function SkillEvidenceSection({ dict, skills }: { dict: Dictionary; skills: UserSkill[] }) {
  const data = await getSkillEvidenceData();
  const summaries = summarizeSkillEvidence(data.evidence);
  const copy = dict.earn.v2.skillsV2;

  return (
    <section aria-labelledby="skill-evidence" className="space-y-2">
      <div>
        <h2 id="skill-evidence" className="text-base font-semibold">
          {copy.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.hint}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {skills.map((skill) => {
          const s = summaries.get(skill.id) ?? EMPTY_SKILL_EVIDENCE;
          const paths = data.pathsBySkill[skill.id] ?? [];
          const latest = data.evidence.find((e) => e.user_skill_id === skill.id && e.description);
          return (
            <Card key={skill.id}>
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 font-semibold break-words">{skill.skill_name}</p>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", LEVEL_STYLE[s.level])}>{copy.levels[s.level]}</span>
                </div>
                <dl className="grid grid-cols-3 gap-1.5 text-center">
                  {(["learning", "action", "outcome"] as const).map((d) => (
                    <div key={d} className="rounded-xl bg-muted/60 px-1 py-2">
                      <dd className="text-lg font-bold tabular-nums">{s.counts[d]}</dd>
                      <dt className="text-[11px] text-muted-foreground">{copy.dims[d]}</dt>
                    </div>
                  ))}
                </dl>
                <p className="text-xs text-muted-foreground">
                  {paths.length ? (
                    <>
                      {copy.supports}:{" "}
                      {paths.map((p, i) => (
                        <span key={p.id}>
                          {i > 0 ? ", " : ""}
                          <Link href={`/earn/paths/${p.id}`} className="font-medium text-primary underline-offset-2 hover:underline">
                            {p.title}
                          </Link>
                        </span>
                      ))}
                    </>
                  ) : (
                    copy.noPaths
                  )}
                </p>
                {latest?.description ? (
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {copy.recent}: {latest.description}
                  </p>
                ) : null}
                <LogLearningButton skillId={skill.id} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
