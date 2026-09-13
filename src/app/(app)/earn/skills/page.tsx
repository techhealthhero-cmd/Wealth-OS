import type { Metadata } from "next";

import { SkillList } from "@/features/skills/components/skill-list";

export const metadata: Metadata = { title: "Skills — Wealth OS" };

export default function EarnSkillsPage() {
  return <SkillList />;
}
