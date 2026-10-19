import { getUserSkills } from "@/features/skills/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { SkillForm } from "./skill-form";
import { EmptyState } from "@/components/shared/empty-state";
import { Artwork } from "@/components/shared/artwork";
import { SkillEvidenceSection } from "@/features/earn/components/v2/skill-evidence-section";

/** Skills in Earn are evidence, not a second gamification dashboard. */
export async function SkillList() {
  const [skills, profile] = await Promise.all([getUserSkills(), getProfile()]);
  const dict = getDictionary(await getLocale(profile?.preferred_language));

  if (skills.length === 0) {
    return (
      <EmptyState
        illustration={<Artwork src="/artwork/earn/skill-development.webp" className="w-44 drop-shadow-[0_4px_6px_rgba(30,18,6,0.12)] sm:w-52" />}
        title={dict.earn.skills.emptyTitle}
        description={dict.earn.skills.emptyState}
        action={<SkillForm />}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{dict.earn.v2.skillsV2.title}</h2>
          <p className="text-sm text-muted-foreground">{dict.earn.v2.skillsV2.hint}</p>
        </div>
        <SkillForm />
      </div>
      <SkillEvidenceSection dict={dict} skills={skills} hideHeading />
    </div>
  );
}
