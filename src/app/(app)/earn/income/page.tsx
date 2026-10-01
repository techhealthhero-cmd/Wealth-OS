import type { Metadata } from "next";

import { IncomeSourceList } from "@/features/income-sources/components/income-source-list";
import { IncomeTargetSection } from "@/features/income-target/components/income-target-section";
import { IncomePlannerSection } from "@/features/income-plans/components/income-planner-section";
import { getPrivacyGate } from "@/features/account-privacy/gate";
import { AccountPrivacyPlaceholder } from "@/features/account-privacy/components/account-privacy-placeholder";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";

export const metadata: Metadata = { title: "Income — Wealth OS" };

export default async function EarnIncomePage() {
  const privacyGate = await getPrivacyGate("planning");
  if (privacyGate) {
    return <AccountPrivacyPlaceholder {...privacyGate} section="generic" />;
  }

  const profile = await getProfile();
  const dict = getDictionary(await getLocale(profile?.preferred_language));

  return (
    <div className="space-y-4">
      <IncomeSourceList />
      <details className="group rounded-2xl border bg-card px-4">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between font-medium">
          <span>{dict.earn.planner.title}</span><span className="text-muted-foreground group-open:hidden">+</span>
        </summary>
        <div className="border-t pb-4 pt-4"><IncomePlannerSection /></div>
      </details>
      <details className="group rounded-2xl border bg-card px-4">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between font-medium">
          <span>{dict.earn.target.title}</span><span className="text-muted-foreground group-open:hidden">+</span>
        </summary>
        <div className="border-t pb-4 pt-4"><IncomeTargetSection /></div>
      </details>
    </div>
  );
}
