import Link from "next/link";
import { ArrowRight, ChevronRight, CircleSlash2, Clock, CloudOff, Coins, EyeOff, RotateCcw, Sprout, Target, WalletCards } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconChip } from "@/components/shared/icon-chip";
import { formatMoney } from "@/lib/financial/money";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/i18n/dictionaries";
import type { EarnStageResult, IncomePathType, NextAction } from "@/lib/earn/types";
import type { RecommendedExperiment } from "@/lib/earn/recommendations";
import type { HubPath, PathIncome } from "@/features/earn/v2-queries";
import type { IncomeGapResult } from "@/lib/financial/income-gap";
import type { AccountPrivacyState } from "@/features/account-privacy/types";
import { fill, localizeMission, nextActionHref, tr } from "./helpers";
import { PATH_ICON_COMPONENTS } from "./path-icons";

export const PATH_ICONS = PATH_ICON_COMPONENTS;

/** Where the user is — plain language, no technical stage names, no scores. */
export function EarnSituationCard({ dict, stage }: { dict: Dictionary; stage: EarnStageResult }) {
  const copy = dict.earn.v2.stage[stage.stage];
  return (
    <section className="flex items-start gap-3 border-b border-primary/10 pb-4">
        <IconChip icon={Sprout} className="mt-0.5 ring-4 ring-primary/5" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{dict.earn.v2.hub.situation}</p>
          <p className="mt-1 text-lg font-semibold leading-snug text-balance">{copy.title}</p>
          <div className="mt-1 flex flex-wrap gap-x-1.5 text-sm">
            <span className="text-muted-foreground">{dict.earn.v2.hub.immediateGoal}</span>
            <span className="font-medium text-foreground">{dict.earn.v2.hub.goals[stage.stage]}</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="-mr-2 shrink-0"
          nativeButton={false}
          render={<Link href="/earn/diagnostic" aria-label={dict.earn.v2.hub.reassess} />}
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
        </Button>
    </section>
  );
}

/**
 * THE primary element of the Hub: one action, the strongest visual weight.
 * When the action is a concrete mission, its own title is the headline
 * ("หาลูกค้าเว็บไซต์ 5 ราย") — the generic engine copy becomes the reason.
 */
export function NextActionCard({
  dict,
  primary,
  secondary,
  missionTitles,
  contextLabel,
}: {
  dict: Dictionary;
  primary: NextAction;
  secondary: NextAction[];
  missionTitles: Record<string, string>;
  contextLabel?: string;
}) {
  const missionTitle = primary.missionId ? missionTitles[primary.missionId] : undefined;
  const title = missionTitle ?? tr(dict, primary.titleKey);
  const reason = tr(dict, primary.reasonKey);
  return (
    <section aria-labelledby="earn-next-action" className="space-y-2.5">
      <div
        className="relative isolate overflow-hidden rounded-[2rem] p-5 pr-16 text-primary-foreground shadow-[0_22px_44px_-22px_color-mix(in_oklab,var(--primary)_88%,transparent)] sm:p-7"
        style={{
          background:
            "radial-gradient(120% 90% at 100% 0%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(160deg, color-mix(in oklab, var(--primary) 78%, #5fb88a), var(--primary))",
        }}
      >
        <div className="pointer-events-none absolute -right-12 -top-16 -z-10 size-48 rounded-full border border-white/10 bg-white/5" aria-hidden="true" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-primary-foreground/85">{dict.earn.v2.hub.todayQuestion}</p>
          {contextLabel ? <span className="max-w-full truncate rounded-full bg-black/10 px-2.5 py-1 text-xs text-primary-foreground/85">{contextLabel}</span> : null}
        </div>
        <h2 id="earn-next-action" className="mt-2 max-w-2xl text-2xl font-bold leading-snug text-balance sm:text-[1.75rem]">
          {title}
        </h2>
        {!missionTitle ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-primary-foreground/85 sm:text-base">{reason}</p> : null}
        <div className="mt-4 flex flex-col gap-3 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between">
          {primary.estimatedMinutes ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
              <Clock className="size-3.5" aria-hidden="true" />
              {fill(dict.earn.v2.missions.minutes, { n: primary.estimatedMinutes })}
            </span>
          ) : (
            <span />
          )}
          <Button
            className="h-12 w-full rounded-2xl bg-white px-5 font-semibold text-primary shadow-sm transition-transform hover:bg-white/90 active:scale-[0.98] min-[380px]:w-auto motion-reduce:transform-none"
            nativeButton={false}
            render={<Link href={nextActionHref(primary)} />}
          >
            {tr(dict, primary.ctaKey)}
            <ArrowRight className="ml-1 size-4" aria-hidden="true" />
          </Button>
        </div>
        {primary.reasonCodes.length > 0 ? (
          <details className="group mt-1 text-sm">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 font-medium text-primary-foreground/90 underline-offset-4 hover:underline focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
              {dict.earn.v2.hub.whyTitle}
            </summary>
            <ul className="mt-1 space-y-1 text-primary-foreground/90">
              {primary.reasonCodes.map((code) => (
                <li key={code} className="flex gap-2">
                  <span aria-hidden="true">•</span>
                  {dict.earn.v2.hub.why[code]}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
      {secondary.length > 0 ? (
        <div className="space-y-1.5">
          <p className="px-1 text-xs text-muted-foreground">{dict.earn.v2.hub.alsoCanDo}</p>
          {secondary.map((a) => (
            <Link
              key={a.actionKind}
              href={nextActionHref(a)}
              className="flex min-h-11 items-center justify-between gap-2 rounded-2xl border bg-card px-4 py-2.5 text-sm shadow-xs transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0 truncate">{(a.missionId && missionTitles[a.missionId]) || tr(dict, a.titleKey)}</span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** Privacy Center presentation for hidden amounts — the user's chosen style, never a leak. */
function ProtectedAmounts({ dict, privacy }: { dict: Dictionary; privacy: AccountPrivacyState }) {
  const p = privacy.displayStyle === "unavailable"
    ? { icon: CloudOff, title: dict.accountPrivacy.genericUnavailableTitle, description: dict.accountPrivacy.genericUnavailableDescription }
    : privacy.displayStyle === "empty"
      ? { icon: WalletCards, title: dict.accountPrivacy.genericEmptyTitle, description: dict.accountPrivacy.genericEmptyDescription }
      : privacy.displayStyle === "custom"
        ? { icon: CircleSlash2, title: privacy.customMessage || dict.accountPrivacy.customFallback, description: null }
        : { icon: EyeOff, title: dict.accountPrivacy.genericProtectedTitle, description: dict.accountPrivacy.genericProtectedDescription };
  const Icon = p.icon;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed bg-muted/35 px-4 py-3" role="status">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background text-primary shadow-xs">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{p.title}</p>
        {p.description ? <p className="text-xs text-muted-foreground">{p.description}</p> : null}
      </div>
    </div>
  );
}

/**
 * The Hub's anchor: "how far am I from the income I want?" — the existing
 * deterministic Income Gap (average real income vs the user's target).
 * Without a target, the card asks for one instead of showing a bare ฿0.
 * The user's stage sits underneath as one plain sentence.
 */
export function IncomeGoalCard({
  dict,
  gap,
  averageMonthlyIncomeCents,
  stage,
  privacy,
  hidden,
}: {
  dict: Dictionary;
  gap: IncomeGapResult;
  averageMonthlyIncomeCents: number;
  stage: EarnStageResult;
  privacy: AccountPrivacyState;
  hidden: boolean;
}) {
  const hub = dict.earn.v2.hub;
  const target = gap.targetMonthlyIncomeCents ?? 0;
  const pct = target > 0 ? Math.min(100, Math.max(0, Math.round((averageMonthlyIncomeCents / target) * 100))) : 0;
  return (
    <Card className="rounded-[1.75rem] shadow-xs">
      <CardContent className="space-y-3 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Target className="size-4 text-primary dark:text-[#7FD6B2]" aria-hidden="true" />
            {hub.goalTitle}
          </p>
          {gap.hasTarget && !hidden ? (
            <Link href="/earn/income#income-target" className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-primary dark:text-[#7FD6B2]">
              {hub.editTarget}
            </Link>
          ) : null}
        </div>

        {hidden ? (
          <ProtectedAmounts dict={dict} privacy={privacy} />
        ) : !gap.hasTarget ? (
          <div className="space-y-3">
            <div>
              <p className="text-lg font-bold leading-snug text-balance">{hub.noTargetTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">{hub.noTargetBody}</p>
            </div>
            <Button variant="outline" className="h-11 rounded-2xl" nativeButton={false} render={<Link href="/earn/income#income-target" />}>
              {hub.setTarget}
              <ChevronRight className="ml-1 size-4" aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <div>
            {gap.achieved ? (
              <>
                <p className="text-2xl font-bold text-primary dark:text-[#7FD6B2]">{hub.goalReached}</p>
                <p className="mt-1 text-sm text-muted-foreground">{hub.goalReachedBody}</p>
              </>
            ) : (
              <p className="text-2xl font-bold tabular-nums">
                {fill(hub.gapLeft, { amount: formatMoney(gap.gapCents ?? 0) })}{" "}
                <span className="text-base font-medium text-muted-foreground">{hub.perMonth}</span>
              </p>
            )}
            <div
              className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-label={hub.goalTitle}
            >
              <div className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {fill(hub.avgOfTarget, { avg: formatMoney(averageMonthlyIncomeCents), target: formatMoney(target) })}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 border-t pt-3 text-sm">
          <Sprout className="size-4 shrink-0 text-primary dark:text-[#7FD6B2]" aria-hidden="true" />
          <p className="min-w-0 flex-1 leading-snug">
            <span className="text-muted-foreground">{hub.situation}: </span>
            {dict.earn.v2.stage[stage.stage].title}
          </p>
          <Link href="/earn/diagnostic" className="inline-flex min-h-11 shrink-0 items-center gap-1 px-1 text-xs font-medium text-primary dark:text-[#7FD6B2]">
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {hub.reassess}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

/** One path: type, where it is on the roadmap, and its current mission. */
export function IncomePathCard({ dict, item }: { dict: Dictionary; item: HubPath }) {
  const type = item.path.path_type as IncomePathType;
  const Icon = PATH_ICONS[type];
  const stepNames = dict.earn.v2.roadmap[type] as Record<string, string>;
  const pct = Math.round((item.progress.currentIndex / item.progress.total) * 100);
  const paused = item.path.status === "paused";
  return (
    <Link
      href={`/earn/paths/${item.path.id}`}
      className="group block rounded-[1.75rem] border bg-card p-4 shadow-xs transition-[background-color,transform,box-shadow] hover:-translate-y-0.5 hover:bg-muted/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none"
    >
      <div className="flex items-start gap-3">
        <IconChip icon={Icon} tone={paused ? "slate" : "mint"} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{item.path.title}</p>
          <p className="text-xs text-muted-foreground">
            {dict.earn.v2.pathTypes[type].title}
            {paused ? ` · ${dict.earn.v2.paths.paused}` : ""}
          </p>
        </div>
        <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
      </div>
      <div className="mt-3">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {item.progress.isComplete
              ? dict.earn.v2.paths.completed
              : `${dict.earn.v2.paths.whereIAm}: ${stepNames[item.progress.currentStepKey ?? ""] ?? ""}`}
          </span>
          <span>{fill(dict.earn.v2.paths.stepOf, { current: Math.min(item.progress.currentIndex + 1, item.progress.total), total: item.progress.total })}</span>
        </div>
        <div
          className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={item.progress.total}
          aria-valuenow={item.progress.currentIndex}
          aria-label={item.path.title}
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        {item.currentMission ? (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed">
            <span className="text-muted-foreground">{dict.earn.v2.paths.whatsNext}: </span>
            {localizeMission(dict, type, item.currentMission).title}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

/**
 * The focused path in one card: where it is on the roadmap (step N of M,
 * now → next) and the real money Earn paths produced this month, with the
 * one button that closes the loop — record income that actually arrived.
 */
export function PathFocusCard({
  dict,
  item,
  income,
  hidden,
}: {
  dict: Dictionary;
  item: HubPath;
  income: PathIncome;
  hidden: boolean;
}) {
  const type = item.path.path_type as IncomePathType;
  const Icon = PATH_ICONS[type];
  const names = dict.earn.v2.roadmap[type] as Record<string, string>;
  const hub = dict.earn.v2.hub;
  const { progress } = item;
  const pct = Math.round((progress.currentIndex / progress.total) * 100);
  const showIncome = type !== "investment" && income.available;
  return (
    <section aria-labelledby="earn-roadmap">
      <Card className="rounded-[1.75rem] shadow-xs">
        <CardContent className="space-y-4 p-5 sm:p-6">
          <Link
            href={`/earn/paths/${item.path.id}`}
            className="group -m-2 block rounded-2xl p-2 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-center gap-3">
              <IconChip icon={Icon} tone="mint" className="size-10" />
              <div className="min-w-0 flex-1">
                <h2 id="earn-roadmap" className="truncate font-semibold">{item.path.title}</h2>
                <p className="text-xs text-muted-foreground">
                  {progress.isComplete
                    ? dict.earn.v2.paths.completed
                    : fill(dict.earn.v2.paths.stepOf, { current: Math.min(progress.currentIndex + 1, progress.total), total: progress.total })}
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-0.5 text-sm font-medium text-primary dark:text-[#7FD6B2]">
                {hub.openPath}
                <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
              </span>
            </div>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.currentIndex}
              aria-label={item.path.title}
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            {!progress.isComplete ? (
              <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-sm">
                <span className="text-muted-foreground">{hub.roadmapCurrent}</span>
                <span className="font-semibold">{names[progress.currentStepKey ?? ""]}</span>
                {progress.nextStepKey ? (
                  <>
                    <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    <span className="text-muted-foreground">{names[progress.nextStepKey]}</span>
                  </>
                ) : null}
              </p>
            ) : null}
          </Link>

          {showIncome ? (
            <div className="border-t pt-4">
              {/* Hidden amounts: the goal card above already explains the lock; here just mask. */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{hub.earnIncomeMonth}</p>
                  {hidden ? (
                    <p className="text-xl font-bold tracking-widest text-muted-foreground" aria-label={dict.accountPrivacy.genericProtectedTitle}>••••</p>
                  ) : income.monthlyTotals.length ? (
                    income.monthlyTotals.map((t) => (
                      <p key={t.currency} className="text-xl font-bold tabular-nums">{formatMoney(t.amountMinor, t.currency)}</p>
                    ))
                  ) : (
                    <p className="text-xl font-bold tabular-nums">{formatMoney(0)}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">{hub.fromRealTransactions}</p>
                </div>
                <Button variant="outline" className="h-11 rounded-2xl" nativeButton={false} render={<Link href={`/earn/paths/${item.path.id}/income`} />}>
                  <Coins className="mr-1.5 size-4" aria-hidden="true" />
                  {dict.earn.v2.income.record}
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

/** Suggested small experiments with the reasons behind them — never a fake percentage. */
export function RecommendedExperimentCard({ dict, experiment }: { dict: Dictionary; experiment: RecommendedExperiment }) {
  const copy = (dict.earn.v2.experiments as Record<string, { title: string; body: string }>)[experiment.key];
  const Icon = PATH_ICONS[experiment.pathType];
  const href = `/earn/paths/new?type=${experiment.pathType}&experiment=${experiment.key}`;
  return (
    <div className="rounded-3xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <IconChip icon={Icon} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{dict.earn.v2.pathTypes[experiment.pathType].title}</p>
          <p className="font-semibold leading-snug">{copy?.title ?? experiment.key}</p>
          <p className="mt-1 text-sm text-muted-foreground">{copy?.body}</p>
        </div>
      </div>
      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={dict.earn.v2.result.experimentsTitle}>
        {experiment.reasonCodes.slice(0, 3).map((code) => (
          <li key={code} className="rounded-full bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary dark:text-[#7FD6B2]">
            {dict.earn.v2.reasons[code]}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3.5" aria-hidden="true" />
          {fill(dict.earn.v2.missions.minutes, { n: experiment.estimatedMinutes })}
        </span>
        <Button size="sm" className={cn("h-10 rounded-xl")} nativeButton={false} render={<Link href={href} />}>
          {dict.earn.v2.result.startThis}
        </Button>
      </div>
    </div>
  );
}
