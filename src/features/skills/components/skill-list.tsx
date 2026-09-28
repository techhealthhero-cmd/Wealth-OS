import { getUserSkills } from "@/features/skills/queries";
import { getIncomeMissions } from "@/features/income-missions/queries";
import { getOpportunityCatalog } from "@/features/opportunities/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { SkillForm } from "./skill-form";
import { SkillCard } from "./skill-card";
import { EmptyState } from "@/components/shared/empty-state";
import { EarnIllustration } from "@/components/illustrations";
import { Award, BriefcaseBusiness, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calculateSkillProgress } from "@/lib/skills/progress";

export async function SkillList() {
  const [skills, profile, missions, opportunities] = await Promise.all([
    getUserSkills(),
    getProfile(),
    getIncomeMissions(),
    getOpportunityCatalog(),
  ]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  if (skills.length === 0) {
    return (
      <EmptyState
        illustration={<EarnIllustration size={140} />}
        title={dict.earn.skills.emptyTitle}
        description={dict.earn.skills.emptyState}
        action={<SkillForm />}
      />
    );
  }

  const opportunityCategories = new Map(
    opportunities.map((opportunity) => [opportunity.id, opportunity.required_skill_categories])
  );
  const completedMissions = missions.filter((mission) => mission.status === "completed");
  const workCountByCategory = new Map<string, number>();

  for (const mission of completedMissions) {
    if (!mission.related_opportunity_id) continue;
    const categories = opportunityCategories.get(mission.related_opportunity_id) ?? [];
    for (const category of new Set(categories)) {
      workCountByCategory.set(category, (workCountByCategory.get(category) ?? 0) + 1);
    }
  }

  const skillProgress = skills.map((skill) => ({
    skill,
    progress: calculateSkillProgress(workCountByCategory.get(skill.category) ?? 0),
  }));
  const totalCompletedWork = completedMissions.length;
  const highestLevel = Math.max(...skillProgress.map(({ progress }) => progress.level));

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#e5f4ec_0%,#f4f7f3_58%,#eef2ed_100%)] p-5 ring-1 ring-primary/8 dark:bg-[linear-gradient(135deg,rgba(45,107,82,0.28)_0%,rgba(22,33,27,0.92)_65%)] sm:p-6">
        <div className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full border-[18px] border-white/45 dark:border-white/5" />
        <div className="pointer-events-none absolute bottom-3 right-28 size-3 rounded-full bg-primary/15" />
        <div className="relative flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_10px_24px_-14px_rgba(31,77,62,0.75)]">
            <Award className="size-7" strokeWidth={1.8} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary/75">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  {dict.earn.skills.skillCollectionEyebrow}
                </p>
                <h2 className="mt-1 text-xl font-semibold leading-tight">{dict.earn.skills.skillCollectionTitle}</h2>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  {dict.earn.skills.skillCollectionDescription}
                </p>
              </div>
              <SkillForm
                trigger={
                  <Button size="sm" className="rounded-full px-4">
                    <Plus className="size-4" aria-hidden="true" />
                    {dict.earn.skills.addSkill}
                  </Button>
                }
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1.5 text-xs font-medium text-foreground ring-1 ring-foreground/5 dark:bg-white/8">
                <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
                {skills.length} {dict.earn.skills.skillsCount}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1.5 text-xs font-medium text-foreground ring-1 ring-foreground/5 dark:bg-white/8">
                <BriefcaseBusiness className="size-3.5 text-primary" aria-hidden="true" />
                {totalCompletedWork} {dict.earn.skills.completedWorkCount}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1.5 text-xs font-medium text-foreground ring-1 ring-foreground/5 dark:bg-white/8">
                <Award className="size-3.5 text-primary" aria-hidden="true" />
                {dict.earn.skills.highestLevel.replace("{level}", String(highestLevel))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="font-semibold">{dict.earn.skills.yourSkills}</h3>
          <p className="text-xs text-muted-foreground">{dict.earn.skills.progressHint}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {skillProgress.map(({ skill, progress }) => (
          <SkillCard key={skill.id} skill={skill} progress={progress} />
        ))}
      </div>
    </div>
  );
}
