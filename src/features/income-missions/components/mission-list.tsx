import { getIncomeMissions } from "@/features/income-missions/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { MissionCard } from "./mission-card";
import { EmptyState } from "@/components/shared/empty-state";
import { EarnIllustration } from "@/components/illustrations";
import { getFeatureLimit } from "@/lib/billing/entitlements";
import { LockedFeatureCard } from "@/features/billing/components/locked-feature-card";

export async function MissionList() {
  const [missions, profile, missionsMax] = await Promise.all([
    getIncomeMissions(),
    getProfile(),
    getFeatureLimit("incomeMissionsMax"),
  ]);
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

  const visible = missionsMax !== null ? missions.slice(0, missionsMax) : missions;
  const hiddenCount = missions.length - visible.length;

  return (
    <div className="grid gap-3">
      {visible.map((mission) => (
        <MissionCard key={mission.id} mission={mission} />
      ))}
      {hiddenCount > 0 ? (
        <LockedFeatureCard
          title={dict.billing.locked.moreMissionsTitle}
          description={dict.billing.locked.moreMissionsDescription.replace("{count}", String(hiddenCount))}
          ctaLabel={dict.billing.upgradeCta}
        />
      ) : null}
    </div>
  );
}
