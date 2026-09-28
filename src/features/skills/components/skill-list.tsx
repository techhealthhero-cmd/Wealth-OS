import { getUserSkills } from "@/features/skills/queries";
import { getIncomeMissions } from "@/features/income-missions/queries";
import { getOpportunityCatalog } from "@/features/opportunities/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { SkillForm } from "./skill-form";
import { SkillMap } from "./skill-map";
import { EmptyState } from "@/components/shared/empty-state";
import { EarnIllustration } from "@/components/illustrations";
import { BarChart3, Crown, Shield } from "lucide-react";
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
  const rankProgress = calculateSkillProgress(totalCompletedWork);
  const rankNumber = String(rankProgress.level).padStart(2, "0");
  const nextRankText = rankProgress.nextLevel
    ? dict.earn.skills.nextRank
        .replace("{count}", String(rankProgress.workUntilNextLevel))
        .replace("{rank}", String(rankProgress.nextLevel).padStart(2, "0"))
    : dict.earn.skills.maxRank;

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground shadow-card sm:p-6">
        <div className="pointer-events-none absolute -left-10 -top-20 size-48 rounded-full border-[34px] border-white/[0.035]" />
        <div className="pointer-events-none absolute -bottom-24 right-8 size-56 rounded-full border-[38px] border-white/[0.035]" />
        <div className="relative flex items-center gap-4 sm:gap-5">
          <div className="relative flex size-16 shrink-0 items-center justify-center sm:size-20">
            <Shield className="absolute inset-0 size-full fill-white/10 text-[#9de0bf]" strokeWidth={1.5} aria-hidden="true" />
            <Crown className="absolute -top-2 size-4 fill-[#d7f3e5] text-[#d7f3e5] sm:size-5" strokeWidth={1.5} aria-hidden="true" />
            <BarChart3 className="relative size-7 text-white sm:size-8" strokeWidth={2} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-white/70 sm:text-sm">{dict.earn.skills.incomeBuilderRank}</p>
                <p className="mt-0.5 text-2xl font-semibold leading-none sm:text-3xl">
                  {dict.earn.skills.rankLabel.replace("{rank}", rankNumber)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xl font-semibold sm:text-2xl">{totalCompletedWork}</p>
                <p className="text-[10px] text-white/65 sm:text-xs">{dict.earn.skills.completedWorkCount}</p>
              </div>
            </div>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-white/15"
              role="progressbar"
              aria-label={dict.earn.skills.rankProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={rankProgress.progressPercent}
            >
              <div
                className="h-full rounded-full bg-[#bcebd2] transition-[width] duration-(--motion-value) ease-(--ease-emphasized)"
                style={{ width: `${rankProgress.progressPercent}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-white/65 sm:text-xs">
              <span>{nextRankText}</span>
              <span>{skills.length} {dict.earn.skills.skillsCount}</span>
            </div>
          </div>
        </div>
      </section>

      <SkillMap items={skillProgress} />
    </div>
  );
}
