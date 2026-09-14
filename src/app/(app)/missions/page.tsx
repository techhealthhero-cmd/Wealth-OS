import type { Metadata } from "next";

import { getUserProgress } from "@/features/engagement/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { ProgressCard } from "@/features/engagement/components/progress-card";
import { WealthMissionList } from "@/features/engagement/components/wealth-mission-list";

export const metadata: Metadata = { title: "Missions — Wealth OS" };

export default async function MissionsPage() {
  const [progress, profile] = await Promise.all([getUserProgress(), getProfile()]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h1 className="text-2xl font-semibold">{dict.missions.title}</h1>
        <p className="text-sm text-muted-foreground">{dict.missions.subtitle}</p>
      </div>
      <ProgressCard progress={progress} />
      <WealthMissionList />
    </div>
  );
}
