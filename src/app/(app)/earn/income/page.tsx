import type { Metadata } from "next";

import { IncomeSourceList } from "@/features/income-sources/components/income-source-list";
import { IncomeTargetSection } from "@/features/income-target/components/income-target-section";
import { getPrivacyGate } from "@/features/account-privacy/gate";
import { AccountPrivacyPlaceholder } from "@/features/account-privacy/components/account-privacy-placeholder";

export const metadata: Metadata = { title: "Income — Wealth OS" };

export default async function EarnIncomePage() {
  const privacyGate = await getPrivacyGate("planning");
  if (privacyGate) {
    return <AccountPrivacyPlaceholder {...privacyGate} section="generic" />;
  }

  return (
    <div className="space-y-6">
      <IncomeTargetSection />
      <IncomeSourceList />
    </div>
  );
}
