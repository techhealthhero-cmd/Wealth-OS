import type { Metadata } from "next";

import { GoalList } from "@/features/goals/components/goal-list";

export const metadata: Metadata = { title: "Goals — Wealth OS" };

export default function GoalsPage() {
  return <GoalList />;
}
