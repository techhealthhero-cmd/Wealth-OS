import type { Metadata } from "next";

import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { getFinancialSummary, getFinancialPriority } from "@/features/ai/tools";
import { getVisibleInsights } from "@/features/ai/lib/insights";
import { buildMonthlyHealthCheck } from "@/features/ai/lib/health-check";
import { NextBestActionCard } from "@/features/ai/components/next-best-action-card";
import { MonthlyHealthCheckCard } from "@/features/ai/components/monthly-health-check-card";
import { InsightCards } from "@/features/ai/components/insight-card";
import { FinancialSnapshotStrip } from "@/features/ai/components/financial-snapshot-strip";
import { AICoachChat } from "@/features/ai/components/ai-coach-chat";
import { AIUsageIndicator } from "@/features/billing/components/ai-usage-indicator";

export const metadata: Metadata = { title: "AI Money Coach — Wealth OS" };

export default async function AICoachPage() {
  const [profile, snapshot, priority, insights, healthCheck] = await Promise.all([
    getProfile(),
    getFinancialSummary(),
    getFinancialPriority(),
    getVisibleInsights(),
    buildMonthlyHealthCheck(),
  ]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-24">
      <div>
        <h1 className="text-lg font-semibold">{dict.aiCoach.title}</h1>
        <p className="text-sm text-muted-foreground">{dict.aiCoach.subtitle}</p>
      </div>

      <FinancialSnapshotStrip snapshot={snapshot} />

      <NextBestActionCard priority={priority} />

      {insights.length > 0 ? <InsightCards insights={insights} /> : null}

      <MonthlyHealthCheckCard health={healthCheck} showPriorityAction={false} />

      <AIUsageIndicator />

      <AICoachChat />

      <p className="text-center text-xs text-muted-foreground">{dict.aiCoach.disclaimer}</p>
    </div>
  );
}
