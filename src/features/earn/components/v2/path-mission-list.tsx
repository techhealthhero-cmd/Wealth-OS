import Link from "next/link";
import { CheckCircle2, ChevronRight, Clock, Flag, ListChecks } from "lucide-react";

import { getIncomePaths, getPathMissions } from "@/features/earn/v2-queries";
import type { Dictionary } from "@/i18n/dictionaries";
import type { IncomePathType } from "@/lib/earn/types";
import { Button } from "@/components/ui/button";
import { fill, localizeMission, organizeMissionQueue } from "./helpers";

/**
 * Earn V2 missions across the user's active paths: what's open and what is
 * waiting for a result. Each row opens the mission's detail page — the
 * single place a path mission is completed (legacy actions refuse them).
 */
export async function PathMissionList({ dict }: { dict: Dictionary }) {
  const paths = (await getIncomePaths()).filter((p) => p.status === "active" || p.status === "paused");
  const missions = await getPathMissions(paths.map((p) => p.id));
  const byId = new Map(paths.map((p) => [p.id, p]));
  const copy = dict.earn.v2.missionsV2;
  const queue = organizeMissionQueue(missions);
  const history = missions.filter((m) => m.status === "completed" || m.status === "skipped");

  const missionMeta = (mission: (typeof missions)[number]) => {
    const path = byId.get(mission.income_path_id ?? "");
    return (
      <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        <span className="max-w-48 truncate">{path?.title}</span>
        {mission.estimated_minutes ? (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" aria-hidden="true" />
            {fill(dict.earn.v2.missions.minutes, { n: mission.estimated_minutes })}
          </span>
        ) : null}
      </span>
    );
  };

  const titleFor = (mission: (typeof missions)[number]) => {
    const path = byId.get(mission.income_path_id ?? "");
    return localizeMission(dict, path?.path_type as IncomePathType | undefined, mission).title;
  };

  return (
    <section aria-labelledby="path-missions" className="space-y-2">
      <div>
        <h2 id="path-missions" className="text-base font-semibold">
          {copy.pathMissions}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.pathMissionsHint}</p>
      </div>
      {!queue.primary ? (
        <div className="space-y-3 rounded-2xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">{copy.noPathMissions}</p>
          <Button size="sm" className="h-10 rounded-xl" nativeButton={false} render={<Link href={paths.length ? "/earn/paths" : "/earn/paths/new"} />}>
            {copy.choosePath}
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <section aria-labelledby="mission-now" className="space-y-2">
            <p id="mission-now" className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{copy.now}</p>
            <div className="overflow-hidden rounded-[1.75rem] border border-primary/15 bg-linear-to-br from-primary/8 via-card to-card shadow-sm">
              <div className="p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Flag className="size-5" aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold leading-snug text-balance">{titleFor(queue.primary)}</h3>
                    {queue.primary.description ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{localizeMission(dict, byId.get(queue.primary.income_path_id ?? "")?.path_type, queue.primary).description}</p> : null}
                    <div className="mt-2">{missionMeta(queue.primary)}</div>
                  </div>
                </div>
                <Button className="mt-4 h-12 w-full rounded-2xl sm:w-auto" nativeButton={false} render={<Link href={`/earn/missions/${queue.primary.id}`} />}>
                  {queue.primary.status === "completed" ? copy.pendingResult : copy.open}
                  <ChevronRight className="ml-1 size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </section>

          {queue.next.length ? (
            <section aria-labelledby="mission-next" className="space-y-2">
              <p id="mission-next" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{copy.next}</p>
              <ul className="divide-y border-y">
                {queue.next.map((m) => (
                  <li key={m.id}>
                    <Link href={`/earn/missions/${m.id}`} className="flex min-h-16 items-center gap-3 py-3 focus-visible:rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"><ListChecks className="size-4" aria-hidden="true" /></span>
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium leading-snug break-words">{titleFor(m)}</p>{missionMeta(m)}</div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {queue.later.length ? (
            <details className="group rounded-2xl border bg-card px-4 py-1">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span>{copy.later} · {queue.later.length}</span><ChevronRight className="size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
              </summary>
              <ul className="divide-y border-t">
                {queue.later.map((m) => <li key={m.id}><Link href={`/earn/missions/${m.id}`} className="flex min-h-14 items-center justify-between gap-3 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="min-w-0 truncate">{titleFor(m)}</span><ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /></Link></li>)}
              </ul>
            </details>
          ) : null}
        </div>
      )}
      {history.length ? (
        <details className="group rounded-2xl border bg-card px-4 py-1">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 text-primary" aria-hidden="true" />{copy.history} · {history.length}</span>
            <ChevronRight className="size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
          </summary>
          <ul className="divide-y border-t">
            {history.map((m) => <li key={m.id}><Link href={`/earn/missions/${m.id}`} className="flex min-h-12 items-center justify-between gap-3 py-2.5 text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="min-w-0 truncate">{titleFor(m)}</span><ChevronRight className="size-4 shrink-0" aria-hidden="true" /></Link></li>)}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
