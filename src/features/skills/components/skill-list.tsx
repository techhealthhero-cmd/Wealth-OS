import { getUserSkills } from "@/features/skills/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { SkillForm } from "./skill-form";
import { SkillCard } from "./skill-card";
import { EmptyState } from "@/components/shared/empty-state";
import { EarnIllustration } from "@/components/illustrations";

export async function SkillList() {
  const [skills, profile] = await Promise.all([getUserSkills(), getProfile()]);
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

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <SkillForm />
      </div>
      <div className="grid gap-3">
        {skills.map((skill) => (
          <SkillCard key={skill.id} skill={skill} />
        ))}
      </div>
    </div>
  );
}
