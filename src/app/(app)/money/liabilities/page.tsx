import type { Metadata } from "next";

import { LiabilityList } from "@/features/liabilities/components/liability-list";
import { getPrivacyGate } from "@/features/account-privacy/gate";
import { AccountPrivacyPlaceholder } from "@/features/account-privacy/components/account-privacy-placeholder";

export const metadata: Metadata = { title: "Liabilities — Wealth OS" };

export default async function LiabilitiesPage() {
  const privacyGate = await getPrivacyGate("planning");
  if (privacyGate) {
    return <AccountPrivacyPlaceholder {...privacyGate} section="generic" />;
  }

  return <LiabilityList />;
}
