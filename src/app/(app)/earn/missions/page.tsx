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
        <section aria-labelledby="legacy-missions" className="space-y-2">
          <div>
            <h2 id="legacy-missions" className="text-base font-semibold">
              {copy.legacyTitle}
            </h2>
            <p className="text-sm text-muted-foreground">{copy.legacyHint}</p>
          </div>
          <MissionList />
        </section>
      ) : null}
    </div>
  );
}
