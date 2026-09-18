import Link from "next/link";

import { captureError } from "@/lib/observability";
import { getGoals } from "@/features/goals/queries";
import { calculateAmountRemaining, calculateGoalProgress, calculateGoalScheduleStatus, type GoalScheduleStatus } from "@/lib/financial/goals";
import { formatMoney, parseMoneyToCents } from "@/lib/financial/money";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { getProfile } from "@/features/profile/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GoalProgressRing } from "./charts-lazy";
import type { FinancialGoal } from "@/types/database";
import { ChevronRight } from "lucide-react";

const SCHEDULE_BADGE_CLASS: Record<string, string> = {
  achieved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  ahead: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  on_track: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
  behind: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  unknown: "bg-muted text-muted-foreground",
};

interface GoalProgressData {
  dict: ReturnType<typeof getDictionary>;
  topGoal: FinancialGoal | null;
  progress: number;
  remaining: number;
  schedule: GoalScheduleStatus;
}

/**
 * Data loading isolated from JSX construction (react-hooks/error-boundaries
 * flags try/catch around JSX — a thrown render error isn't actually caught
 * there), matching the pattern already used by wealth-overview.tsx's
 * loadWealthOverviewData().
 */
async function loadGoalProgressData(): Promise<GoalProgressData | null> {
  try {
    const profile = await getProfile();
    const locale = await getLocale(profile?.preferred_language);
    const dict = getDictionary(locale);
    const goals = await getGoals();
    const topGoal = goals[0] ?? null;

    if (!topGoal) {
      return { dict, topGoal: null, progress: 0, remaining: 0, schedule: "unknown" };
    }

    const currentCents = parseMoneyToCents(topGoal.current_amount);
    const targetCents = parseMoneyToCents(topGoal.target_amount);
    // target_date is a "YYYY-MM-DD" date-only string — anchor to local
    // midnight rather than letting a bare parse read it as UTC midnight,
    // which shifts a day on any server runtime whose offset is behind UTC.
    const targetDate = topGoal.target_date ? new Date(`${topGoal.target_date}T00:00:00`) : null;
    const monthlyCents = parseMoneyToCents(topGoal.monthly_contribution);

    return {
      dict,
      topGoal,
      progress: calculateGoalProgress(currentCents, targetCents),
      remaining: calculateAmountRemaining(currentCents, targetCents),
      schedule: calculateGoalScheduleStatus(currentCents, targetCents, targetDate, monthlyCents),
    };
  } catch (error) {
    captureError(error, { route: "dashboard.GoalProgressCard", operation: "load_goals_data" });
    return null;
  }
}

/**
 * UX reorg (2026-09): "Financial Goals" gets its own dashboard moment
 * (position 7 in the requested hierarchy — after the monthly overview,
 * before spending breakdown) instead of being one equally-weighted cell
 * inside the old wealth-overview grid. Reuses the exact same deterministic
 * calculateGoalProgress()/calculateAmountRemaining()/
 * calculateGoalScheduleStatus() already used on /plan/goals (goal-card.tsx)
 * — no new goal math, just a second, simpler presentation of it.
 */
export async function GoalProgressCard() {
  const data = await loadGoalProgressData();
  if (!data) return null;

  const { dict, topGoal, progress, remaining, schedule } = data;

  if (!topGoal) {
    return (
      <Link href="/plan/goals">
        <Card variant="soft" className="card-interactive transition-opacity hover:opacity-90">
          <CardContent className="space-y-1 pt-6">
            <p className="text-sm font-medium">{dict.goals.emptyTitle}</p>
            <p className="text-sm text-muted-foreground">{dict.goals.emptyState}</p>
          </CardContent>
        </Card>
      </Link>
    );
  }

  const currentCents = parseMoneyToCents(topGoal.current_amount);
  const targetCents = parseMoneyToCents(topGoal.target_amount);

  return (
    <Link href="/plan/goals">
      <Card className="card-interactive transition-opacity hover:opacity-90">
        <CardContent className="pt-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <GoalProgressRing progress={progress} label={dict.goals.progress} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="break-words text-base font-semibold leading-snug">{topGoal.name}</p>
              <p className="break-all text-[11px] tracking-tight text-muted-foreground min-[375px]:text-sm">
                {formatMoney(currentCents)} / {formatMoney(targetCents)}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={SCHEDULE_BADGE_CLASS[schedule]}>{dict.goals.schedule[schedule]}</Badge>
                <span className="break-all text-xs text-muted-foreground">
                  {dict.goals.remaining}: {formatMoney(remaining)}
                </span>
              </div>
            </div>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
