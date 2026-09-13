import { getIncomeMissions } from "@/features/income-missions/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { MissionCard } from "./mission-card";
import { EmptyState } from "@/components/shared/empty-state";
import { EarnIllustration } from "@/components/illustrations";

export async function MissionList() {
  const [missions, profile] = await Promise.all([getIncomeMissions(), getProfile()]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  if (missions.length === 0) {
    return (
      <EmptyState
        illustration={<EarnIllustration size={140} />}
        title={dict.earn.missions.emptyTitle}
        description={dict.earn.missions.emptyState}
      />
    );
  }

  return (
    <div className="grid gap-3">
      {missions.map((mission) => (
        <MissionCard key={mission.id} mission={mission} />
      ))}
    </div>
  );
}
