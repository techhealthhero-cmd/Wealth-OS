import type { NextAction } from "@/lib/earn/types";

/** Resolve a dotted locale key ("earn.nextAction.x.title") against a dictionary. */
export function tr(dict: unknown, key: string): string {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in (node as Record<string, unknown>)) node = (node as Record<string, unknown>)[part];
    else return key;
  }
  return typeof node === "string" ? node : key;
}

export function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), template);
}

/** Where each Next Action takes the user — one tap from the Hub. */
export function nextActionHref(action: NextAction): string {
  switch (action.actionKind) {
    case "complete_diagnostic":
      return "/earn/diagnostic";
    case "choose_income_path":
      return "/earn/paths/new";
    case "initialize_income_path":
    case "continue_mission":
      return action.pathId ? `/earn/paths/${action.pathId}` : "/earn/paths";
    case "record_mission_result":
      return action.missionId ? `/earn/missions/${action.missionId}/result` : "/earn/paths";
    case "record_income":
      return action.pathId ? `/earn/paths/${action.pathId}/income` : "/earn/paths";
    case "build_resilience":
      return "/plan/emergency-fund";
    case "review_freedom_plan":
      return "/plan/money-year";
    default:
      return "/earn/paths";
  }
}

/**
 * Display copy for a mission. Earn V2 path missions are generated from a
 * (path type, roadmap step) template, so they render in the CURRENT language
 * from that template key — the title stored at creation is only a fallback.
 * Legacy and any custom missions keep their stored title untouched.
 */
export function localizeMission(
  dict: unknown,
  pathType: string | null | undefined,
  m: { title: string; description?: string | null; roadmap_step_key?: string | null; income_path_id?: string | null }
): { title: string; description: string | null } {
  if (m.income_path_id && pathType && m.roadmap_step_key) {
    const copy = (dict as { earn?: { v2?: { missions?: Record<string, Record<string, { title?: string; description?: string }>> } } })
      .earn?.v2?.missions?.[pathType]?.[m.roadmap_step_key];
    if (copy?.title) return { title: copy.title, description: copy.description ?? m.description ?? null };
  }
  return { title: m.title, description: m.description ?? null };
}

/**
 * Path missions the user still has to act on: open ones, plus completed
 * result-required ones whose result isn't recorded yet (those come first —
 * the path can't move on until they're done).
 */
export function actionablePathMissions<T extends { status: string; result_required: boolean; hasResult: boolean }>(missions: T[]): T[] {
  const pendingResult = (m: T) => m.status === "completed" && m.result_required && !m.hasResult;
  return missions
    .filter((m) => m.status === "not_started" || m.status === "in_progress" || pendingResult(m))
    .sort((a, b) => Number(pendingResult(b)) - Number(pendingResult(a)));
}

export interface MissionQueueItem {
  id: string;
  income_path_id: string | null;
  earn_project_id?: string | null;
  roadmap_step_key: string | null;
  status: string;
  result_required: boolean;
  hasResult: boolean;
  sequence_order: number;
  created_at: string;
}

/**
 * Stable UI identity for generated roadmap work. Historical rows predate
 * migration 0035, so presentation derives the same identity without mutating
 * or deleting any result/evidence-linked history.
 */
export function missionLogicalKey(mission: MissionQueueItem): string {
  return [mission.income_path_id ?? "legacy", mission.roadmap_step_key ?? mission.id, mission.earn_project_id ?? "no-project"].join(":");
}

function missionPriority(mission: MissionQueueItem): number {
  if (mission.status === "completed" && mission.result_required && !mission.hasResult) return 3;
  if (mission.status === "in_progress") return 2;
  return 1;
}

/** Consolidate accidental historical open duplicates for display only. */
export function consolidateActionableMissions<T extends MissionQueueItem>(missions: T[]): T[] {
  const byIdentity = new Map<string, T>();
  for (const mission of actionablePathMissions(missions)) {
    const key = missionLogicalKey(mission);
    const current = byIdentity.get(key);
    if (!current || missionPriority(mission) > missionPriority(current) || (missionPriority(mission) === missionPriority(current) && mission.created_at < current.created_at)) {
      byIdentity.set(key, mission);
    }
  }
  return [...byIdentity.values()].sort((a, b) => {
    const pending = missionPriority(b) - missionPriority(a);
    if (pending) return pending;
    return a.sequence_order - b.sequence_order || a.created_at.localeCompare(b.created_at);
  });
}

export function organizeMissionQueue<T extends MissionQueueItem>(missions: T[], primaryMissionId?: string | null) {
  const rows = consolidateActionableMissions(missions);
  const primaryIndex = primaryMissionId ? rows.findIndex((m) => m.id === primaryMissionId) : -1;
  const primary = primaryIndex >= 0 ? rows.splice(primaryIndex, 1)[0] : rows.shift() ?? null;
  return { primary, next: rows.slice(0, 2), later: rows.slice(2) };
}
