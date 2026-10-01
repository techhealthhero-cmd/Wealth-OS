import type { Metadata } from "next";

import { MissionList } from "@/features/income-missions/components/mission-list";
import { PathMissionList } from "@/features/earn/components/v2/path-mission-list";
import { getLegacyIncomeMissions } from "@/features/income-missions/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";

export const metadata: Metadata = { title: "Missions — Wealth OS" };

export default async function EarnMissionsPage() {
  const [profile, legacy] = await Promise.all([getProfile(), getLegacyIncomeMissions()]);
  const dict = getDictionary(await getLocale(profile?.preferred_language));
  const copy = dict.earn.v2.missionsV2;

  return (
    <div className="space-y-6">
      <PathMissionList dict={dict} />
      {/* Classic missions keep working; the section shows only for users who have them. */}
      {legacy.length > 0 ? (
        <details className="rounded-2xl border bg-card px-4">
          <summary id="legacy-missions" className="flex min-h-12 cursor-pointer items-center text-sm font-medium text-muted-foreground">
            {copy.legacyTitle} · {legacy.length}
          </summary>
          <div className="space-y-2 border-t pb-4 pt-3">
            <p className="text-sm text-muted-foreground">{copy.legacyHint}</p>
            <MissionList />
          </div>
        </details>
      ) : null}
    </div>
  );
}
