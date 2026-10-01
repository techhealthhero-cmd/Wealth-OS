import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";

import { getIncomePaths, getPathMissions } from "@/features/earn/v2-queries";
import type { Dictionary } from "@/i18n/dictionaries";
import type { IncomePathType } from "@/lib/earn/types";
import { Button } from "@/components/ui/button";
import { actionablePathMissions, fill, localizeMission } from "./helpers";

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
  const rows = actionablePathMissions(missions);

  return (
    <section aria-labelledby="path-missions" className="space-y-2">
      <div>
        <h2 id="path-missions" className="text-base font-semibold">
          {copy.pathMissions}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.pathMissionsHint}</p>
      </div>
      {rows.length === 0 ? (
        <div className="space-y-3 rounded-2xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">{copy.noPathMissions}</p>
          <Button size="sm" className="h-10 rounded-xl" nativeButton={false} render={<Link href={paths.length ? "/earn/paths" : "/earn/paths/new"} />}>
            {copy.choosePath}
          </Button>
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {rows.map((m) => {
            const path = byId.get(m.income_path_id ?? "");
            const pending = m.status === "completed";
            const title = localizeMission(dict, path?.path_type as IncomePathType | undefined, m).title;
            return (
              <li key={m.id}>
                <Link
                  href={`/earn/missions/${m.id}`}
                  className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug break-words">{title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span className="truncate">{path?.title}</span>
                      {m.estimated_minutes ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3" aria-hidden="true" />
                          {fill(dict.earn.v2.missions.minutes, { n: m.estimated_minutes })}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  {pending ? (
                    <span className="shrink-0 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                      {copy.pendingResult}
                    </span>
                  ) : null}
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
