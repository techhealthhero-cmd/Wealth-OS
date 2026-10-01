import type { Metadata } from "next";

import { PathMissionList } from "@/features/earn/components/v2/path-mission-list";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";

export const metadata: Metadata = { title: "Missions — Wealth OS" };

export default async function EarnMissionsPage() {
  const profile = await getProfile();
  const dict = getDictionary(await getLocale(profile?.preferred_language));
  return <PathMissionList dict={dict} />;
}
