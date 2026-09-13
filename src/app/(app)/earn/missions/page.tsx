import type { Metadata } from "next";

import { MissionList } from "@/features/income-missions/components/mission-list";

export const metadata: Metadata = { title: "Missions — Wealth OS" };

export default function EarnMissionsPage() {
  return <MissionList />;
}
