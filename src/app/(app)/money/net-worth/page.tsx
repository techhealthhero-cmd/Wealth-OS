import type { Metadata } from "next";

import { getNetWorthBreakdown, getNetWorthSnapshots, recordTodaysNetWorthSnapshot } from "@/features/net-worth/queries";
import { getAccounts } from "@/features/accounts/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { NetWorthView } from "@/features/net-worth/components/net-worth-view";
import { EmptyState } from "@/components/shared/empty-state";
import { WelcomeIllustration } from "@/components/illustrations";

export const metadata: Metadata = { title: "Net Worth — Wealth OS" };

export default async function NetWorthPage() {
  const [breakdown, accounts, profile] = await Promise.all([
    getNetWorthBreakdown(),
    getAccounts(),
    getProfile(),
  ]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  if (accounts.length === 0 && breakdown.assets.length === 0) {
    return (
      <div className="mx-auto max-w-lg py-8">
        <EmptyState
          illustration={<WelcomeIllustration size={140} />}
          title={dict.netWorth.emptyTitle}
          description={dict.netWorth.emptyState}
        />
      </div>
    );
  }

  await recordTodaysNetWorthSnapshot(breakdown);
  const snapshots = await getNetWorthSnapshots();

  return <NetWorthView breakdown={breakdown} snapshots={snapshots} />;
}
