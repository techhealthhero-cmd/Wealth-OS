import Link from "next/link";

import { getEarnOverview } from "@/features/earn/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { IncomeGapCard } from "@/features/income-target/components/income-gap-card";
import { OpportunityCard } from "@/features/opportunities/components/opportunity-card";
import { MissionCard } from "@/features/income-missions/components/mission-card";
import { IncomeProfileCard } from "@/features/income-profile/components/income-profile-card";
import { EmptyState } from "@/components/shared/empty-state";
import { EarnIllustration } from "@/components/illustrations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMoney, parseMoneyToCents } from "@/lib/financial/money";
import { ArrowRight } from "lucide-react";

export async function EarnOverview() {
  const [overview, profile] = await Promise.all([getEarnOverview(), getProfile()]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  const hasAnyData = overview.sources.length > 0 || overview.profile.currentMonthlyIncomeCents > 0;

  if (!hasAnyData) {
    return (
      <EmptyState
        illustration={<EarnIllustration size={160} />}
        title={dict.earn.title}
        description={dict.earn.dashboard.startFirstOpportunity}
        action={
          <Button nativeButton={false} render={<Link href="/earn/income" />}>
            {dict.earn.income.addSource}
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Income Hero */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">{dict.earn.dashboard.currentIncome}</p>
          <p className="text-3xl font-bold">{formatMoney(overview.profile.averageMonthlyIncomeCents)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {dict.earn.dashboard.activeSourceCount}: {overview.profile.activeSourceCount}
          </p>
        </CardContent>
      </Card>

      <IncomeGapCard gap={overview.gap} averageMonthlyIncomeCents={overview.profile.averageMonthlyIncomeCents} />

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{dict.earn.dashboard.topOpportunity}</p>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/earn/opportunities" />}>
            {dict.earn.dashboard.viewAll}
            <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
        {overview.topOpportunity ? (
          <OpportunityCard ranked={overview.topOpportunity} hasActiveMissions={overview.topOpportunityHasActiveMissions} />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{dict.earn.dashboard.noOpportunityYet}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{dict.earn.dashboard.todayMission}</p>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/earn/missions" />}>
            {dict.earn.dashboard.viewAll}
            <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
        {overview.todayMission ? (
          <MissionCard mission={overview.todayMission} />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{dict.earn.dashboard.noMissionActive}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <IncomeProfileCard profile={overview.profile} />

      <Card>
        <CardHeader className="flex items-center justify-between space-y-0">
          <CardTitle className="text-base">{dict.earn.dashboard.incomeSources}</CardTitle>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/earn/income" />}>
            {dict.earn.dashboard.viewAll}
            <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </CardHeader>
        <CardContent>
          {overview.sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">{dict.earn.income.emptyState}</p>
          ) : (
            <ul className="space-y-1.5">
              {overview.sources.slice(0, 5).map((source) => (
                <li key={source.id} className="flex items-center justify-between text-sm">
                  <span>{source.name}</span>
                  <span className="font-medium">{formatMoney(parseMoneyToCents(source.expected_monthly_income))}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
