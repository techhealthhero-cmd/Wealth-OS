import Link from "next/link";
import { ArrowRight, Clock, Lock, RotateCcw, Sprout } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconChip } from "@/components/shared/icon-chip";
import { formatMoney } from "@/lib/financial/money";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/i18n/dictionaries";
import type { EarnStageResult, IncomePathType, NextAction } from "@/lib/earn/types";
import type { RecommendedExperiment } from "@/lib/earn/recommendations";
import type { HubPath, PathIncome } from "@/features/earn/v2-queries";
import { fill, nextActionHref, tr } from "./helpers";
import { PATH_ICON_COMPONENTS } from "./path-icons";

export const PATH_ICONS = PATH_ICON_COMPONENTS;

/** Where the user is — plain language, no technical stage names, no scores. */
export function EarnSituationCard({ dict, stage }: { dict: Dictionary; stage: EarnStageResult }) {
  const copy = dict.earn.v2.stage[stage.stage];
  return (
    <Card className="border-primary/10 bg-linear-to-br from-primary/8 to-transparent">
      <CardContent className="flex items-start gap-3 pt-5">
        <IconChip icon={Sprout} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{dict.earn.v2.hub.situation}</p>
          <p className="mt-0.5 text-base font-semibold leading-snug text-balance">{copy.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{copy.body}</p>
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
      </CardContent>
    </Card>
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
}: {
  dict: Dictionary;
  primary: NextAction;
  secondary: NextAction[];
  missionTitles: Record<string, string>;
}) {
  const missionTitle = primary.missionId ? missionTitles[primary.missionId] : undefined;
  const title = missionTitle ?? tr(dict, primary.titleKey);
  const reason = tr(dict, primary.reasonKey);
  return (
    <section aria-labelledby="earn-next-action" className="space-y-2">
      <div
        className="relative overflow-hidden rounded-3xl p-5 text-primary-foreground shadow-[0_12px_28px_-14px_color-mix(in_oklab,var(--primary)_80%,transparent)]"
        style={{
          background:
            "radial-gradient(120% 90% at 100% 0%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(160deg, color-mix(in oklab, var(--primary) 78%, #5fb88a), var(--primary))",
        }}
      >
        <p className="text-sm font-medium text-primary-foreground/80">{dict.earn.v2.hub.todayQuestion}</p>
        <h2 id="earn-next-action" className="mt-1 text-xl font-bold leading-snug text-balance">
          {title}
        </h2>
        <p className="mt-1.5 text-sm text-primary-foreground/85">{missionTitle ? tr(dict, primary.titleKey) : reason}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          {primary.estimatedMinutes ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
              <Clock className="size-3.5" aria-hidden="true" />
              {fill(dict.earn.v2.missions.minutes, { n: primary.estimatedMinutes })}
            </span>
          ) : (
            <span />
          )}
          <Button
            className="h-11 rounded-2xl bg-white px-5 font-semibold text-primary hover:bg-white/90"
            nativeButton={false}
            render={<Link href={nextActionHref(primary)} />}
          >
            {tr(dict, primary.ctaKey)}
            <ArrowRight className="ml-1 size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
      {secondary.length > 0 ? (
        <div className="space-y-1.5">
          <p className="px-1 text-xs text-muted-foreground">{dict.earn.v2.hub.alsoCanDo}</p>
          {secondary.map((a) => (
            <Link
              key={a.actionKind}
              href={nextActionHref(a)}
              className="flex min-h-11 items-center justify-between gap-2 rounded-2xl border bg-card px-4 py-2.5 text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

/**
 * Income progress: average monthly income vs target (the existing Income
 * Profile / Income Target systems, THB) and, below, income that came from
 * Earn paths (per currency, from real linked transactions only).
 */
export function IncomeProgressCard({
  dict,
  income,
  hidden,
  averageMonthlyCents,
  targetMonthlyCents,
}: {
  dict: Dictionary;
  income: PathIncome;
  hidden: boolean;
  averageMonthlyCents: number | null;
  targetMonthlyCents: number | null;
}) {
  const pct = averageMonthlyCents !== null && targetMonthlyCents ? Math.min(100, Math.round((averageMonthlyCents / targetMonthlyCents) * 100)) : null;
  return (
    <Card>
      <CardContent className="pt-5">
        {averageMonthlyCents !== null ? (
          <div className="mb-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">{dict.earn.v2.hub.avgMonthly}</p>
                <p className="text-2xl font-bold tabular-nums">{hidden ? "••••" : formatMoney(averageMonthlyCents)}</p>
              </div>
              {targetMonthlyCents ? (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{dict.earn.v2.hub.target}</p>
                  <p className="text-base font-semibold tabular-nums">{hidden ? "••••" : formatMoney(targetMonthlyCents)}</p>
                </div>
              ) : null}
            </div>
            {pct !== null && !hidden ? (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={dict.earn.v2.hub.target}>
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            ) : null}
          </div>
        ) : null}
        <p className="text-sm font-medium text-muted-foreground">{dict.earn.v2.hub.incomeProgress}</p>
        {hidden ? (
          <p className="mt-2 flex items-center gap-2 text-2xl font-bold tracking-widest text-muted-foreground" aria-label={dict.accountPrivacy.title}>
            <Lock className="size-4" aria-hidden="true" /> ••••
          </p>
        ) : !income.available ? (
          <p className="mt-2 text-sm text-muted-foreground">{dict.earn.v2.income.migrationPending}</p>
        ) : income.totals.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{dict.earn.v2.hub.noLinkedIncome}</p>
        ) : (
          <div className="mt-1 space-y-0.5">
            {income.totals.map((t) => (
              <p key={t.currency} className="text-2xl font-bold tabular-nums">
                {formatMoney(t.amountMinor, t.currency)}
              </p>
            ))}
          </div>
        )}
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
      className="block rounded-3xl border bg-card p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
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
          <p className="mt-2 truncate text-sm">
            <span className="text-muted-foreground">{dict.earn.v2.paths.whatsNext}: </span>
            {item.currentMission.title}
          </p>
        ) : null}
      </div>
    </Link>
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
