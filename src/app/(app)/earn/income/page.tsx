import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";

import { IncomeSourceList } from "@/features/income-sources/components/income-source-list";
import { IncomeTargetSection } from "@/features/income-target/components/income-target-section";
import { IncomePlannerSection } from "@/features/income-plans/components/income-planner-section";
import { getPrivacyGate } from "@/features/account-privacy/gate";
import { AccountPrivacyPlaceholder } from "@/features/account-privacy/components/account-privacy-placeholder";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";

export const metadata: Metadata = { title: "Income — Wealth OS" };

/**
 * Income tab, answer first: how far from my goal (gap + target) → what my
 * income looks like (profile, sources) → optional planning tools.
 */
export default async function EarnIncomePage() {
  const privacyGate = await getPrivacyGate("planning");
  if (privacyGate) {
    return <AccountPrivacyPlaceholder {...privacyGate} section="generic" />;
  }

  const profile = await getProfile();
  const dict = getDictionary(await getLocale(profile?.preferred_language));

  return (
    <div className="space-y-4">
      <section id="income-target" aria-label={dict.earn.target.title} className="scroll-mt-24">
        <IncomeTargetSection />
      </section>
      <IncomeSourceList />
      <details className="group rounded-2xl border bg-card px-4">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span>{dict.earn.planner.title}</span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
        </summary>
        <div className="border-t pb-4 pt-4"><IncomePlannerSection /></div>
      </details>
    </div>
  );
}
