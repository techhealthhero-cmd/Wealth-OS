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
