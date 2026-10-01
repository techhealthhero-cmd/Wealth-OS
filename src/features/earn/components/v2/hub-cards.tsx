import Link from "next/link";
import { ArrowRight, Check, ChevronRight, Circle, CircleSlash2, Clock, CloudOff, EyeOff, Flag, RotateCcw, Sprout, TrendingUp, WalletCards } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconChip } from "@/components/shared/icon-chip";
import { formatMoney } from "@/lib/financial/money";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/i18n/dictionaries";
import type { EarnStageResult, IncomePathType, NextAction } from "@/lib/earn/types";
import type { RecommendedExperiment } from "@/lib/earn/recommendations";
import type { HubPath, PathIncome } from "@/features/earn/v2-queries";
import type { AccountPrivacyState } from "@/features/account-privacy/types";
import { fill, localizeMission, nextActionHref, tr } from "./helpers";
import { PATH_ICON_COMPONENTS } from "./path-icons";

export const PATH_ICONS = PATH_ICON_COMPONENTS;

/** Where the user is — plain language, no technical stage names, no scores. */
export function EarnSituationCard({ dict, stage }: { dict: Dictionary; stage: EarnStageResult }) {
  const copy = dict.earn.v2.stage[stage.stage];
  return (
    <Card className="overflow-hidden rounded-[1.75rem] border-primary/10 bg-linear-to-br from-primary/9 via-card to-card shadow-xs">
      <CardContent className="flex items-start gap-3 px-4 py-5 sm:px-5">
        <IconChip icon={Sprout} className="mt-0.5 ring-4 ring-primary/5" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{dict.earn.v2.hub.situation}</p>
          <p className="mt-1 text-lg font-semibold leading-snug text-balance">{copy.title}</p>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground max-[359px]:line-clamp-2">{copy.body}</p>
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
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-primary-foreground/85 sm:text-base">{missionTitle ? tr(dict, primary.titleKey) : reason}</p>
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

/**
 * Income progress: average monthly income vs target (the existing Income
 * Profile / Income Target systems, THB) and, below, income that came from
 * Earn paths (per currency, from real linked transactions only).
 */
export function IncomeProgressCard({
  dict,
  income,
  privacy,
  hidden,
  averageMonthlyCents,
  targetMonthlyCents,
}: {
  dict: Dictionary;
  income: PathIncome;
  privacy: AccountPrivacyState;
  hidden: boolean;
  averageMonthlyCents: number | null;
  targetMonthlyCents: number | null;
}) {
  const pct = averageMonthlyCents !== null && targetMonthlyCents ? Math.min(100, Math.round((averageMonthlyCents / targetMonthlyCents) * 100)) : null;
  const protectedPresentation = privacy.displayStyle === "unavailable"
    ? { icon: CloudOff, title: dict.accountPrivacy.genericUnavailableTitle, description: dict.accountPrivacy.genericUnavailableDescription }
    : privacy.displayStyle === "empty"
      ? { icon: WalletCards, title: dict.accountPrivacy.genericEmptyTitle, description: dict.accountPrivacy.genericEmptyDescription }
      : privacy.displayStyle === "custom"
        ? { icon: CircleSlash2, title: privacy.customMessage || dict.accountPrivacy.customFallback, description: null }
        : { icon: EyeOff, title: dict.accountPrivacy.genericProtectedTitle, description: dict.accountPrivacy.genericProtectedDescription };
  const ProtectedIcon = protectedPresentation.icon;
  return (
    <Card className="rounded-[1.75rem] shadow-xs">
      <CardContent className="p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <IconChip icon={TrendingUp} tone="mint" className="size-9 [&_svg]:size-4" />
          <div>
            <h2 className="font-semibold">{dict.earn.v2.hub.incomeProgress}</h2>
            <p className="text-xs text-muted-foreground">{dict.earn.v2.hub.incomeProgressHint}</p>
          </div>
        </div>
        {hidden ? (
          <div className="flex min-h-24 items-center gap-3 rounded-2xl border border-dashed bg-muted/35 px-4 py-4" role="status">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background text-primary shadow-xs">
              <ProtectedIcon className="size-4.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-medium">{protectedPresentation.title}</p>
              {protectedPresentation.description ? <p className="text-sm text-muted-foreground">{protectedPresentation.description}</p> : null}
            </div>
          </div>
        ) : (
          <>
        {averageMonthlyCents !== null ? (
          <div className="mb-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">{dict.earn.v2.hub.avgMonthly}</p>
                <p className="text-2xl font-bold tabular-nums">{formatMoney(averageMonthlyCents)}</p>
              </div>
              {targetMonthlyCents ? (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{dict.earn.v2.hub.target}</p>
                  <p className="text-base font-semibold tabular-nums">{formatMoney(targetMonthlyCents)}</p>
                </div>
              ) : null}
            </div>
            {pct !== null ? (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={dict.earn.v2.hub.target}>
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            ) : null}
          </div>
        ) : null}
        <p className="text-sm font-medium text-muted-foreground">{dict.earn.v2.hub.incomeFromPaths}</p>
        {!income.available ? (
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
          </>
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

/** A calm three-step preview: just enough roadmap to orient the user. */
export function RoadmapFocusCard({ dict, item }: { dict: Dictionary; item: HubPath }) {
  const type = item.path.path_type as IncomePathType;
  const names = dict.earn.v2.roadmap[type] as Record<string, string>;
  const completedKey = item.progress.completedStepKeys.at(-1) ?? null;
  const rows = [
    completedKey ? { key: `done-${completedKey}`, label: dict.earn.v2.hub.roadmapDone, title: names[completedKey], state: "done" as const } : null,
    item.progress.currentStepKey
      ? { key: `current-${item.progress.currentStepKey}`, label: dict.earn.v2.hub.roadmapCurrent, title: names[item.progress.currentStepKey], state: "current" as const }
      : { key: "complete", label: dict.earn.v2.hub.roadmapCurrent, title: dict.earn.v2.paths.completed, state: "done" as const },
    item.progress.nextStepKey ? { key: `next-${item.progress.nextStepKey}`, label: dict.earn.v2.hub.roadmapNext, title: names[item.progress.nextStepKey], state: "next" as const } : null,
  ].filter(Boolean) as Array<{ key: string; label: string; title: string; state: "done" | "current" | "next" }>;

  return (
    <section aria-labelledby="earn-roadmap" className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="earn-roadmap" className="text-base font-semibold">{dict.earn.v2.hub.roadmap}</h2>
          <p className="truncate text-xs text-muted-foreground">{item.path.title}</p>
        </div>
        <Link href={`/earn/paths/${item.path.id}`} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-2 text-sm font-medium text-primary hover:bg-primary/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {dict.earn.v2.hub.viewRoadmap}
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      <Card className="rounded-[1.75rem] shadow-xs">
        <CardContent className="p-4 sm:p-5">
          <ol className="space-y-0">
            {rows.map((row, index) => {
              const Icon = row.state === "done" ? Check : row.state === "current" ? Flag : Circle;
              return (
                <li key={row.key} className="relative flex gap-3 pb-4 last:pb-0">
                  {index < rows.length - 1 ? <span className="absolute left-[17px] top-8 h-[calc(100%-1.25rem)] w-px bg-border" aria-hidden="true" /> : null}
                  <span className={cn("relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border", row.state === "current" ? "border-primary bg-primary text-primary-foreground shadow-sm" : row.state === "done" ? "border-primary/20 bg-primary/10 text-primary" : "bg-card text-muted-foreground")}>
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className={cn("text-[11px] font-semibold tracking-wide uppercase", row.state === "current" ? "text-primary" : "text-muted-foreground")}>{row.label}</p>
                    <p className={cn("mt-0.5 text-sm leading-snug", row.state === "current" && "font-semibold")}>{row.title}</p>
                  </div>
                </li>
              );
            })}
          </ol>
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
