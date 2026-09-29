import type { Metadata } from "next";

import { GoalList } from "@/features/goals/components/goal-list";
import { getPrivacyGate } from "@/features/account-privacy/gate";
import { AccountPrivacyPlaceholder } from "@/features/account-privacy/components/account-privacy-placeholder";

export const metadata: Metadata = { title: "Goals — Wealth OS" };

export default async function GoalsPage() {
  const privacyGate = await getPrivacyGate("planning");
  if (privacyGate) {
    return <AccountPrivacyPlaceholder {...privacyGate} section="generic" />;
  }

  return <GoalList />;
}
