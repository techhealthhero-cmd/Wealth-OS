import { todayInTimeZone } from "@/lib/date";
import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

import { hasAnyDashboardData } from "@/features/dashboard/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { NetWorthHero } from "@/features/dashboard/components/net-worth-hero";
import { IncomeThisMonth } from "@/features/dashboard/components/income-this-month";
import { MonthlySpendCard } from "@/features/dashboard/components/monthly-spend-card";
import { HomeQuickActions } from "@/features/dashboard/components/home-quick-actions";
import { HomeExpectedTileCard, HomeTaxTile } from "@/features/dashboard/components/home-tiles";
import { HomeExpectedTile } from "@/features/dashboard/components/home-expected-tile";
import { UpNextPayments } from "@/features/dashboard/components/up-next-payments";
import { DailyInboxSection } from "@/features/capture/components/daily-inbox-section";
import { EmptyState } from "@/components/shared/empty-state";
import { WelcomeIllustration } from "@/components/illustrations";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPrivacyGate } from "@/features/account-privacy/gate";
import { AccountPrivacyPlaceholder } from "@/features/account-privacy/components/account-privacy-placeholder";

export const metadata: Metadata = { title: "Dashboard — Wealth OS" };

export default async function DashboardPage() {
  const privacyGate = await getPrivacyGate(["overview", "activity", "planning", "insights"]);
  if (privacyGate) {
    return <AccountPrivacyPlaceholder {...privacyGate} section="generic" />;
  }

  const profile = await getProfile();
  const today = todayInTimeZone(profile?.timezone ?? "Asia/Bangkok");
  const hasAnyData = await hasAnyDashboardData(today);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  if (!hasAnyData) {
    return (
      <div className="mx-auto max-w-lg py-12">
        <EmptyState
          illustration={<WelcomeIllustration size={150} />}
          title={dict.dashboard.getStarted}
          description={dict.dashboard.emptyState}
          action={
            <Button nativeButton={false} render={<Link href="/money/accounts" />}>
              {dict.dashboard.getStarted}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 pb-[calc(7rem+env(safe-area-inset-bottom))] md:space-y-6 md:pb-8">
      <div className="hidden min-w-0 md:block">
        {/* UX guidelines #6 (Home hierarchy): greeting/context leads the
            page, ahead of the section title — a personal "hello" reads
            as a coach checking in, not an admin-panel page header. Plan
            badge now lives in the shared app header (visible on every
            page), not duplicated here. */}
        <h1 className="truncate text-2xl font-semibold tracking-tight">
          {profile?.display_name
            ? dict.dashboard.greetingCompact.replace("{name}", profile.display_name)
            : dict.dashboard.greetingGenericCompact}
        </h1>
      </div>

      {/* Each data section streams independently. */}
      <div className="motion-reveal motion-reveal-1">
        <Suspense fallback={<Skeleton className="h-[120px] w-full rounded-[20px]" />}>
          <NetWorthHero variant="compact" />
        </Suspense>
      </div>

      {/* Monthly spend card — directly under the net-worth card. Renders
          nothing while `summary` is null. TODO(codex-wiring): pass a real
          MonthlySpendSummary once a monthly-by-category query exists (and
          open MonthlySpendDetail on tap); also hook the slip-auto flow
          (SlipPickSheet) into the existing slip-scan entry. */}
      <MonthlySpendCard summary={null} />

      <div className="motion-reveal motion-reveal-2">
        <HomeQuickActions labels={dict.homeDash} />
      </div>

      {/* One-line "N items need review" nudge — the Daily Inbox itself
          lives on Money › Transactions (2026-10-11). Renders nothing when
          nothing is pending, so Home stays calm. No fallback skeleton: it's
          usually absent, and a flashing placeholder would be noise. */}
      <Suspense fallback={null}>
        <DailyInboxSection />
      </Suspense>

      <div className="motion-reveal motion-reveal-3">
        <div className="grid grid-cols-2 gap-3">
          <Suspense fallback={<HomeExpectedTileCard labels={dict.homeDash} receivables={null} />}>
            <HomeExpectedTile today={today} labels={dict.homeDash} currencyCode={profile?.currency_code ?? "THB"} />
          </Suspense>
          <HomeTaxTile labels={dict.homeDash} />
        </div>
      </div>

      {/* "Up next" payments — money going out, right after money coming in. */}
      <div className="motion-reveal motion-reveal-3">
        <Suspense fallback={<Skeleton className="h-40 w-full rounded-[20px]" />}>
          <UpNextPayments />
        </Suspense>
      </div>

      <div className="motion-reveal motion-reveal-3">
        <Suspense fallback={<Skeleton className="h-72 w-full rounded-[20px]" />}>
          <IncomeThisMonth />
        </Suspense>
      </div>

    </div>
  );
}
