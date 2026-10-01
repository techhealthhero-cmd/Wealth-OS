import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Circle, Clock, Coins, Lock, Target } from "lucide-react";

import { getEarnProjects, getIncomePath, getLinkedIncome, getPathMissions, getSkillEvidenceData } from "@/features/earn/v2-queries";
import { getUserSkills } from "@/features/skills/queries";
import { PathSkillLinks } from "@/features/earn/components/v2/skill-evidence-client";
import { getProfile } from "@/features/profile/queries";
import { getAccountPrivacyState } from "@/features/account-privacy/queries";
import { isPrivacyLockedFor } from "@/features/account-privacy/types";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { getRoadmapProgress, getRoadmapTemplate } from "@/lib/earn/roadmap";
import { getMissionTemplate } from "@/lib/earn/mission-templates";
import { formatMoney } from "@/lib/financial/money";
import { cn } from "@/lib/utils";
import type { IncomePathType } from "@/lib/earn/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconChip } from "@/components/shared/icon-chip";
import { PATH_ICON_COMPONENTS } from "@/features/earn/components/v2/path-icons";
import { fill, localizeMission } from "@/features/earn/components/v2/helpers";
import { MissionActions, PathStatusToggle, ProjectCreateForm } from "@/features/earn/components/v2/path-client";

export const metadata: Metadata = { title: "Earn — Wealth OS" };

export default async function IncomePathPage({ params }: { params: Promise<{ pathId: string }> }) {
  const { pathId } = await params;
  const path = await getIncomePath(pathId); // RLS: only the owner's path is visible
  if (!path) notFound();

  const [missions, income, projects, profile, privacy, skills, skillData] = await Promise.all([
    getPathMissions([path.id]),
    getLinkedIncome([path.id]),
    getEarnProjects(path.id),
    getProfile(),
    getAccountPrivacyState(),
    getUserSkills(),
    getSkillEvidenceData(),
  ]);
  const dict = getDictionary(await getLocale(profile?.preferred_language));
  const v2 = dict.earn.v2;
  const type = path.path_type as IncomePathType;
  const stepNames = v2.roadmap[type] as Record<string, string>;
  const progress = getRoadmapProgress(type, path.current_roadmap_step_key, path.status === "completed");
  const steps = getRoadmapTemplate(type).steps;
  const hidden = isPrivacyLockedFor(privacy, "planning");

  const open = missions.filter((m) => m.status === "not_started" || m.status === "in_progress");
  const awaitingResult = missions.filter((m) => m.result_required && m.status === "completed" && !m.hasResult);
  const current = awaitingResult[0] ?? open.find((m) => m.roadmap_step_key === progress.currentStepKey) ?? open[0] ?? null;
  const history = missions.filter((m) => m.id !== current?.id && m.status === "completed").reverse();
  const currentTemplate = current?.roadmap_step_key ? getMissionTemplate(type, current.roadmap_step_key) : null;
  const currentCopy = current ? localizeMission(dict, type, current) : null;
  const pathIncome = income.byPath[path.id] ?? [];
  const Icon = PATH_ICON_COMPONENTS[type];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <IconChip icon={Icon} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold leading-snug text-balance">{path.title}</h2>
          <p className="text-xs text-muted-foreground">
            {v2.pathTypes[type].title}
            {path.status === "paused" ? ` · ${v2.paths.paused}` : ""}
          </p>
        </div>
        <PathStatusToggle pathId={path.id} status={path.status} />
      </div>

      {type === "investment" ? (
        <p className="rounded-2xl bg-muted px-3 py-2 text-xs text-muted-foreground">{v2.paths.investmentNote}</p>
      ) : null}

      {/* Roadmap: where I am → what's next; the full list only on request. */}
      <Card>
        <CardContent className="pt-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">{v2.paths.whereIAm}</p>
              <p className="font-semibold">{progress.isComplete ? v2.paths.completed : stepNames[progress.currentStepKey ?? ""]}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{v2.paths.whatsNext}</p>
              <p className="font-semibold">{progress.nextStepKey ? stepNames[progress.nextStepKey] : "—"}</p>
            </div>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.currentIndex}
            aria-label={fill(v2.paths.stepOf, { current: Math.min(progress.currentIndex + 1, progress.total), total: progress.total })}
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${(progress.currentIndex / progress.total) * 100}%` }} />
          </div>
          <details className="group mt-3">
            <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-medium text-primary dark:text-[#7FD6B2]">
              <span className="group-open:hidden">{v2.paths.showAll}</span>
              <span className="hidden group-open:inline">{v2.paths.hideAll}</span>
            </summary>
            <ol className="mt-1 space-y-1.5">
              {steps.map((s, i) => {
                const done = i < progress.currentIndex;
                const here = i === progress.currentIndex && !progress.isComplete;
                return (
                  <li key={s.key} className={cn("flex items-center gap-2.5 text-sm", !done && !here && "text-muted-foreground")} aria-current={here ? "step" : undefined}>
                    <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px]", done && "border-primary bg-primary text-primary-foreground", here && "border-primary text-primary dark:text-[#7FD6B2]")}>
                      {done ? <Check className="size-3.5" aria-hidden="true" /> : here ? <Circle className="size-2.5 fill-current" aria-hidden="true" /> : i + 1}
                    </span>
                    <span className={cn(here && "font-semibold text-foreground")}>{stepNames[s.key]}</span>
                  </li>
                );
              })}
            </ol>
          </details>
        </CardContent>
      </Card>

      {/* Current mission — the one thing to do on this path now. */}
      <section aria-labelledby="current-mission" className="space-y-2">
        <h3 id="current-mission" className="text-base font-semibold">
          {v2.missions.title}
        </h3>
        {current ? (
          <Card className="border-primary/20">
            <CardContent className="space-y-3 pt-5">
              <div>
                <p className="font-semibold leading-snug text-balance">{currentCopy?.title}</p>
                {currentCopy?.description ? <p className="mt-1 text-sm text-muted-foreground">{currentCopy.description}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {current.estimated_minutes ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                    <Clock className="size-3.5" aria-hidden="true" />
                    {fill(v2.missions.minutes, { n: current.estimated_minutes })}
                  </span>
                ) : null}
                {current.target_quantity ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                    <Target className="size-3.5" aria-hidden="true" />
                    {fill(v2.missions.target, { n: Number(current.target_quantity) })}
                  </span>
                ) : null}
                {current.result_required && current.status === "completed" && !current.hasResult ? (
                  <span className="rounded-full bg-amber-500/10 px-2.5 py-1 font-medium text-amber-800 dark:text-amber-300">{v2.missions.resultPending}</span>
                ) : null}
              </div>
              <MissionActions missionId={current.id} status={current.status} resultRequired={current.result_required} hasResult={current.hasResult} />
              {currentTemplate?.mayProduceIncome ? (
                <p className="text-xs text-muted-foreground">{v2.income.promptAfterResult}</p>
              ) : null}
              <Link href={`/earn/missions/${current.id}`} className="inline-flex min-h-11 items-center text-sm font-medium text-primary dark:text-[#7FD6B2]">
                {v2.missionsV2.viewDetail}
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-5 text-sm text-muted-foreground">{progress.isComplete ? v2.paths.completed : v2.missions.empty}</CardContent>
          </Card>
        )}
      </section>

      {/* Real income from this path — lives in the real ledger. */}
      {type !== "investment" && income.available ? (
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <IconChip icon={Coins} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{v2.income.total}</p>
              {hidden ? (
                <p className="flex items-center gap-1.5 text-lg font-bold tracking-widest text-muted-foreground">
                  <Lock className="size-3.5" aria-hidden="true" /> ••••
                </p>
              ) : !income.available ? (
                <p className="text-sm text-muted-foreground">{v2.income.migrationPending}</p>
              ) : pathIncome.length ? (
                pathIncome.map((t) => (
                  <p key={t.currency} className="text-lg font-bold tabular-nums">
                    {formatMoney(t.amountMinor, t.currency)}
                  </p>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">{v2.hub.noLinkedIncome}</p>
              )}
            </div>
            {income.available ? (
              <Button size="sm" className="h-10 shrink-0 rounded-xl" nativeButton={false} render={<Link href={`/earn/paths/${path.id}/income`} />}>
                {v2.income.record}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Projects are optional. */}
      {projects.available ? (
      <section aria-labelledby="projects" className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 id="projects" className="text-base font-semibold">
            {v2.projects.title}
          </h3>
          {projects.available ? <ProjectCreateForm pathId={path.id} /> : null}
        </div>
        {!projects.available ? (
          <p className="text-sm text-muted-foreground">{v2.income.migrationPending}</p>
        ) : projects.projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">{v2.projects.empty}</p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {projects.projects.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="min-w-0 truncate font-medium">{p.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{v2.projects.status[p.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      ) : null}

      <section aria-labelledby="path-skills" className="space-y-2">
        <h3 id="path-skills" className="text-base font-semibold">
          {v2.skillsV2.pathSkills}
        </h3>
        <PathSkillLinks
          pathId={path.id}
          skills={skills.map((s) => ({ id: s.id, name: s.skill_name }))}
          linkedIds={skillData.skillsByPath[path.id] ?? []}
        />
      </section>

      {history.length > 0 ? (
        <details className="rounded-2xl border bg-card px-4">
          <summary className="flex min-h-12 cursor-pointer items-center text-sm font-medium">
            {v2.missions.done} ({history.length})
          </summary>
          <ul className="divide-y pb-2">
            {history.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                <span className="min-w-0 truncate">{localizeMission(dict, type, m).title}</span>
                {m.result_required && !m.hasResult ? (
                  <Link href={`/earn/missions/${m.id}/result`} className="shrink-0 text-xs font-medium text-primary dark:text-[#7FD6B2]">
                    {v2.missions.recordResult}
                  </Link>
                ) : (
                  <Check className="size-4 shrink-0 text-primary dark:text-[#7FD6B2]" aria-label={v2.missions.done} />
                )}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
