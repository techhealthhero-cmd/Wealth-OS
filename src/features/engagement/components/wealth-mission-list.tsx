import { getWealthMissions } from "@/features/engagement/queries";
import { syncWealthMissionsData } from "@/features/engagement/actions";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { WealthMissionCard } from "./wealth-mission-card";
import { EmptyState } from "@/components/shared/empty-state";
import { EarnIllustration } from "@/components/illustrations";

export async function WealthMissionList() {
  // Regenerates/refreshes missions from live data before rendering — see
  // syncWealthMissionsData() for why this is safe to call on every view
  // (idempotent, deduped by template key, never double-counts XP) and why
  // it's the render-safe variant (no revalidatePath) rather than the
  // client-callable syncWealthMissions() action.
  await syncWealthMissionsData();

  const [missions, profile] = await Promise.all([getWealthMissions(), getProfile()]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  if (missions.length === 0) {
    return (
      <EmptyState
        illustration={<EarnIllustration size={140} />}
        title={dict.missions.emptyTitle}
        description={dict.missions.emptyState}
      />
    );
  }

  const active = missions.filter((m) => m.status !== "completed" && m.status !== "skipped");
  const done = missions.filter((m) => m.status === "completed" || m.status === "skipped");

  return (
    <div className="grid gap-3">
      {active.map((m) => (
        <WealthMissionCard key={m.id} mission={m} />
      ))}
      {done.map((m) => (
        <WealthMissionCard key={m.id} mission={m} />
      ))}
    </div>
  );
}
