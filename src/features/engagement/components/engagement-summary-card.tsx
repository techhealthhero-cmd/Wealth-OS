import Link from "next/link";

import { getUpcomingBills } from "@/features/recurring/queries";
import { getPendingSubscriptions } from "@/features/subscriptions/queries";
import { getActiveWealthMissions, getUserProgress } from "@/features/engagement/queries";
import { getMonthlyReview } from "@/features/monthly-review/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { formatMoney } from "@/lib/financial/money";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StreakBadge } from "@/components/illustrations";
import { ArrowRight } from "lucide-react";

/**
 * One compact, most-actionable item — never the full list of every
 * engagement surface at once (STEP 11: "do not clutter the dashboard").
 */
export async function EngagementSummaryCard() {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [bills, pendingSubscriptions, activeMissions, progress, prevReview, profile] = await Promise.all([
    getUpcomingBills(),
    getPendingSubscriptions(),
    getActiveWealthMissions(),
    getUserProgress(),
    getMonthlyReview(prevMonth.getFullYear(), prevMonth.getMonth() + 1),
    getProfile(),
  ]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  const reviewDue = now.getDate() >= 3 && prevReview?.completed_at == null;
  const topMission = [...activeMissions].sort((a, b) => (b.impact_level === "high" ? 1 : 0) - (a.impact_level === "high" ? 1 : 0))[0];

  let actionable: { title: string; body: string; href: string } | null = null;
  if (bills.overdue.length > 0) {
    actionable = {
      title: dict.upcomingBills.overdue,
      body: `${bills.overdue[0].label} — ${formatMoney(bills.overdue[0].amountCents)}`,
      href: "/money/recurring",
    };
  } else if (pendingSubscriptions.length > 0) {
    actionable = {
      title: dict.notifications.categories.subscription_detected,
      body: pendingSubscriptions[0].merchant,
      href: "/money/subscriptions",
    };
  } else if (reviewDue) {
    actionable = {
      title: dict.notifications.categories.monthly_review_due,
      body: dict.monthlyReview.startReview,
      href: "/review",
    };
  } else if (topMission) {
    actionable = {
      title: dict.missions.title,
      body: dict.missions.templates[topMission.title as keyof typeof dict.missions.templates]?.title ?? topMission.title,
      href: "/missions",
    };
  } else if (bills.next7Days.length > 0) {
    actionable = {
      title: dict.upcomingBills.next7Days,
      body: `${bills.next7Days[0].label} — ${formatMoney(bills.next7Days[0].amountCents)}`,
      href: "/money/recurring",
    };
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StreakBadge size={20} />
            <span className="text-sm text-muted-foreground">
              {dict.progress.level} {progress.level.level} · {progress.weeklyStreak} {dict.progress.weeksConsistent}
            </span>
          </div>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/missions" />}>
            {dict.dashboard.viewAll}
            <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>

        {actionable ? (
          <Link href={actionable.href} className="block rounded-lg border p-3 transition-colors hover:bg-muted/50">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {actionable.title}
              </Badge>
            </div>
            <p className="mt-1 text-sm font-medium">{actionable.body}</p>
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
