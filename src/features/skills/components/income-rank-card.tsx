"use client";

import {
  BarChart3,
  Check,
  ChevronRight,
  Crown,
  LockKeyhole,
  Shield,
  Sparkles,
} from "lucide-react";

import { useTranslation } from "@/i18n/client";
import {
  INCOME_RANKS,
  type IncomeRankBreakdownItem,
  type IncomeRankProgress,
} from "@/lib/skills/income-rank";
import { asTrigger } from "@/lib/as-trigger";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface IncomeRankCardProps {
  progress: IncomeRankProgress;
  breakdown: IncomeRankBreakdownItem[];
  completedMissionCount: number;
  closedClientCount: number;
  skillCount: number;
}

export function IncomeRankCard({
  progress,
  breakdown,
  completedMissionCount,
  closedClientCount,
  skillCount,
}: IncomeRankCardProps) {
  const { t } = useTranslation();
  const rankNumber = String(progress.rank).padStart(2, "0");
  const title = t(`earn.skills.rankTitles.${progress.titleKey}`);
  const nextRankText = progress.nextRank
    ? t("earn.skills.nextRankXp")
        .replace("{xp}", String(progress.xpToNextRank))
        .replace("{rank}", String(progress.nextRank).padStart(2, "0"))
    : t("earn.skills.maxRank");

  const rankCard = (
    <button
      type="button"
      className="card-interactive relative w-full overflow-hidden rounded-3xl bg-primary p-5 text-left text-primary-foreground shadow-card outline-none ring-1 ring-transparent focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-6"
      aria-label={t("earn.skills.openRankDetails")}
    >
      <span className="pointer-events-none absolute -left-10 -top-20 size-48 rounded-full border-[34px] border-white/[0.035]" />
      <span className="pointer-events-none absolute -bottom-24 right-8 size-56 rounded-full border-[38px] border-white/[0.035]" />
      <span className="relative flex items-center gap-4 sm:gap-5">
        <span className="relative flex size-16 shrink-0 items-center justify-center sm:size-20">
          <Shield className="absolute inset-0 size-full fill-white/10 text-[#9de0bf]" strokeWidth={1.5} aria-hidden="true" />
          <Crown className="absolute -top-2 size-4 fill-[#d7f3e5] text-[#d7f3e5] sm:size-5" strokeWidth={1.5} aria-hidden="true" />
          <BarChart3 className="relative size-7 text-white sm:size-8" strokeWidth={2} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-xs font-medium text-white/70 dark:text-white/90 sm:text-sm">{t("earn.skills.incomeBuilderRank")}</span>
              <span className="mt-0.5 block text-2xl font-semibold leading-none sm:text-3xl">
                {t("earn.skills.rankLabel").replace("{rank}", rankNumber)}
              </span>
              <span className="mt-1 block truncate text-[10px] text-white/60 dark:text-white/85 sm:text-xs">{title}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2 text-right">
              <span>
                <span className="block text-xl font-semibold sm:text-2xl">{progress.totalXp}</span>
                <span className="block text-[10px] text-white/65 dark:text-white/90 sm:text-xs">XP</span>
              </span>
              <ChevronRight className="size-5 text-white/65 dark:text-white/90" aria-hidden="true" />
            </span>
          </span>
          <span className="mt-3 block h-2 overflow-hidden rounded-full bg-white/15">
            <span
              className="block h-full rounded-full bg-[#bcebd2] transition-[width] duration-(--motion-value) ease-(--ease-emphasized)"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </span>
          <span className="mt-2 flex items-center justify-between gap-2 text-[10px] text-white/65 dark:text-white/90 sm:text-xs">
            <span>{nextRankText}</span>
            <span>{skillCount} {t("earn.skills.skillsCount")}</span>
          </span>
        </span>
      </span>
    </button>
  );

  return (
    <Sheet>
      <SheetTrigger {...asTrigger(rankCard)} />
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[90dvh] max-w-2xl overflow-y-auto rounded-t-3xl border-x px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6"
      >
        <SheetHeader className="px-0 pb-1 pt-5">
          <SheetTitle className="text-xl">{t("earn.skills.rankDetailsTitle")}</SheetTitle>
          <SheetDescription>{t("earn.skills.rankDetailsDescription")}</SheetDescription>
        </SheetHeader>

        <div className="rounded-3xl bg-primary p-5 text-primary-foreground">
          <div className="flex items-center gap-4">
            <div className="relative flex size-16 shrink-0 items-center justify-center">
              <Shield className="absolute inset-0 size-full fill-white/10 text-[#9de0bf]" strokeWidth={1.5} aria-hidden="true" />
              <Crown className="absolute -top-2 size-4 fill-[#d7f3e5] text-[#d7f3e5]" strokeWidth={1.5} aria-hidden="true" />
              <BarChart3 className="relative size-7" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/65 dark:text-white/90">{title}</p>
              <p className="text-2xl font-semibold">{t("earn.skills.rankLabel").replace("{rank}", rankNumber)}</p>
              <p className="mt-0.5 text-xs text-white/65 dark:text-white/90">{progress.totalXp} XP</p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-[#bcebd2]" style={{ width: `${progress.progressPercent}%` }} />
          </div>
          <p className="mt-2 text-xs text-white/70 dark:text-white/90">{nextRankText}</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <RankMetric value={progress.totalXp} label={t("earn.skills.totalRankXp")} />
          <RankMetric value={completedMissionCount} label={t("earn.skills.missionsRewarded")} />
          <RankMetric value={closedClientCount} label={t("earn.skills.clientsClosed")} />
        </div>

        <section>
          <h3 className="font-semibold">{t("earn.skills.xpSources")}</h3>
          <div className="mt-2 space-y-2">
            {breakdown.length > 0 ? (
              breakdown.map((item) => (
                <div key={item.missionType} className="flex items-center justify-between gap-3 rounded-2xl bg-secondary p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t(`earn.missions.templates.${item.missionType}.title`)}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.completedCount} {t("earn.skills.timesCompleted")}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    +{item.xpEarned} XP
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                <Sparkles className="mx-auto mb-2 size-5 text-primary" aria-hidden="true" />
                {t("earn.skills.noRankXpYet")}
              </div>
            )}
          </div>
        </section>

        <section>
          <h3 className="font-semibold">{t("earn.skills.rankJourney")}</h3>
          <div className="mt-2 space-y-2">
            {INCOME_RANKS.map((rank) => {
              const isCurrent = rank.rank === progress.rank;
              const isComplete = rank.rank < progress.rank;
              return (
                <div
                  key={rank.rank}
                  className={`flex items-center gap-3 rounded-2xl border p-3 ${isCurrent ? "border-primary/30 bg-primary/5" : "border-border"}`}
                >
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isComplete || isCurrent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isComplete ? <Check className="size-4" aria-hidden="true" /> : isCurrent ? rank.rank : <LockKeyhole className="size-3.5" aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {t("earn.skills.rankLabel").replace("{rank}", String(rank.rank).padStart(2, "0"))} · {t(`earn.skills.rankTitles.${rank.titleKey}`)}
                    </span>
                    <span className="block text-xs text-muted-foreground">{rank.minimumXp} XP</span>
                  </span>
                  {isCurrent ? (
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                      {t("earn.skills.currentRank")}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <p className="rounded-2xl bg-secondary p-3 text-xs leading-relaxed text-muted-foreground">
          {t("earn.skills.rankNeverDrops")}
        </p>
      </SheetContent>
    </Sheet>
  );
}

function RankMetric({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-secondary p-3 text-center">
      <p className="text-lg font-semibold">{value}</p>
      <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground sm:text-xs">{label}</p>
    </div>
  );
}
