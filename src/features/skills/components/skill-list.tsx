import Link from "next/link";
import { ArrowRight, Calculator } from "lucide-react";

import { getUserSkills } from "@/features/skills/queries";
import { getIncomeMissions, getIncomeRankXpEvents } from "@/features/income-missions/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { SkillForm } from "./skill-form";
import { IncomeRankCard } from "./income-rank-card";
import { EmptyState } from "@/components/shared/empty-state";
import { EarnIllustration } from "@/components/illustrations";
import { calculateIncomeRank, type IncomeRankBreakdownItem } from "@/lib/skills/income-rank";
import type { MissionType } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SkillEvidenceSection } from "@/features/earn/components/v2/skill-evidence-section";

export async function SkillList() {
  const [skills, profile, missions, incomeRankEvents] = await Promise.all([
    getUserSkills(),
    getProfile(),
    getIncomeMissions(),
    getIncomeRankXpEvents(),
  ]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  if (skills.length === 0) {
    return (
      <EmptyState
        illustration={<EarnIllustration size={140} />}
        title={dict.earn.skills.emptyTitle}
        description={dict.earn.skills.emptyState}
        action={<SkillForm />}
      />
    );
  }

  const rankProgress = calculateIncomeRank(
    incomeRankEvents.reduce((total, event) => total + event.xp_amount, 0)
  );
  const missionTypeById = new Map(missions.map((mission) => [mission.id, mission.mission_type]));
  const breakdownByType = new Map<MissionType, IncomeRankBreakdownItem>();

  for (const event of incomeRankEvents) {
    if (!event.related_id) continue;
    const missionType = missionTypeById.get(event.related_id);
    if (!missionType) continue;
    const current = breakdownByType.get(missionType) ?? {
      missionType,
      completedCount: 0,
      xpEarned: 0,
    };
    current.completedCount += 1;
    current.xpEarned += event.xp_amount;
    breakdownByType.set(missionType, current);
  }

  const rankBreakdown = [...breakdownByType.values()].sort((a, b) => b.xpEarned - a.xpEarned);
  const closedClientCount = breakdownByType.get("close_client")?.completedCount ?? 0;

  return (
    <div className="space-y-5">
      {/* Earn V2: evidence-based progress first; Rank/XP stay as motivation below. */}
      <SkillEvidenceSection dict={dict} skills={skills} />

      <IncomeRankCard
        progress={rankProgress}
        breakdown={rankBreakdown}
        completedMissionCount={incomeRankEvents.length}
        closedClientCount={closedClientCount}
        skillCount={skills.length}
      />

      <Card className="border-primary/15 bg-primary/[0.035]">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Calculator className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{dict.earn.planner.skillCtaTitle}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{dict.earn.planner.skillCtaDescription}</p>
          </div>
          <Button size="icon-sm" variant="ghost" nativeButton={false} render={<Link href="/earn/income#income-planner-title" />} aria-label={dict.earn.planner.startPlanning}>
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
