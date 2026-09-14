"use client";

import type { UserProgress } from "@/features/engagement/queries";
import { useTranslation } from "@/i18n/client";
import { Card, CardContent } from "@/components/ui/card";
import { StreakBadge } from "@/components/illustrations";

/**
 * Deterministic, forgiving-by-design progress display (Day 6 STEP 3/4) —
 * no "you lost your streak!" language anywhere, just the current count.
 */
export function ProgressCard({ progress }: { progress: UserProgress }) {
  const { t } = useTranslation();
  const { level } = progress;

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{t("progress.title")}</p>
          <span className="text-sm font-semibold">
            {t("progress.level")} {level.level}
          </span>
        </div>

        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${level.progressPercent}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {level.xpForNextLevel !== null
              ? `${level.xpIntoLevel} / ${level.xpForNextLevel} ${t("progress.xp")} — ${t("progress.xpToNextLevel")}`
              : `${level.totalXp} ${t("progress.xp")} — ${t("progress.maxLevelReached")}`}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="flex flex-col items-center gap-1">
            <StreakBadge size={24} />
            <p className="font-medium">
              {progress.weeklyStreak} {t("progress.weeksConsistent")}
            </p>
            <p className="text-muted-foreground">{t("progress.weeklyStreak")}</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <StreakBadge size={24} />
            <p className="font-medium">
              {progress.trackingDaysStreak} {t("progress.daysConsistent")}
            </p>
            <p className="text-muted-foreground">{t("progress.trackingStreak")}</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <StreakBadge size={24} />
            <p className="font-medium">
              {progress.monthlyReviewStreak} {t("progress.monthsConsistent")}
            </p>
            <p className="text-muted-foreground">{t("progress.monthlyReviewStreak")}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
