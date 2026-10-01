import type { EarnReasonCode } from "@/lib/earn/reason-codes";
import type {
  NextAction,
  NextActionInput,
  NextActionKind,
  NextActionResult,
} from "@/lib/earn/types";

/**
 * v2 (product decision, 2026-09-30): someone who skipped the diagnostic
 * ("I already know what I want to do") and already has a path sees their
 * path's work first; the diagnostic stays available as a secondary action.
 * With no path yet, the diagnostic still comes first (v1 behaviour).
 */
export const NEXT_ACTION_RULES_VERSION = "earn-next-action-v2";

const KEYS: Record<NextActionKind, { titleKey: string; reasonKey: string; ctaKey: string }> = {
  complete_diagnostic: keySet("completeDiagnostic"),
  choose_income_path: keySet("chooseIncomePath"),
  initialize_income_path: keySet("initializeIncomePath"),
  record_mission_result: keySet("recordMissionResult"),
  continue_mission: keySet("continueMission"),
  record_income: keySet("recordIncome"),
  improve_cashflow: keySet("improveCashflow"),
  build_resilience: keySet("buildResilience"),
  grow_income: keySet("growIncome"),
  optimize_scale: keySet("optimizeScale"),
  review_freedom_plan: keySet("reviewFreedomPlan"),
};

function keySet(name: string) {
  return {
    titleKey: `earn.nextAction.${name}.title`,
    reasonKey: `earn.nextAction.${name}.reason`,
    ctaKey: `earn.nextAction.${name}.cta`,
  };
}
const PRIMARY_REASON: Record<NextActionKind, EarnReasonCode> = {
  complete_diagnostic: "diagnostic_incomplete",
  choose_income_path: "income_path_missing",
  initialize_income_path: "income_path_not_initialized",
  record_mission_result: "mission_result_pending",
  continue_mission: "mission_ready",
  record_income: "earned_income_not_recorded",
  improve_cashflow: "cashflow_needs_attention",
  build_resilience: "resilience_needs_attention",
  grow_income: "earning_capacity_can_grow",
  optimize_scale: "repeatable_income_can_scale",
  review_freedom_plan: "freedom_plan_needs_review",
};

function action(
  actionKind: NextActionKind,
  references: Partial<Pick<NextAction, "pathId" | "projectId" | "missionId" | "estimatedMinutes">> = {},
  extraReasons: EarnReasonCode[] = []
): NextAction {
  return {
    actionKind,
    ...KEYS[actionKind],
    reasonCodes: [PRIMARY_REASON[actionKind], ...extraReasons.filter((c) => c !== PRIMARY_REASON[actionKind])],
    estimatedMinutes: references.estimatedMinutes ?? null,
    pathId: references.pathId ?? null,
    projectId: references.projectId ?? null,
    missionId: references.missionId ?? null,
    rulesVersion: NEXT_ACTION_RULES_VERSION,
  };
}

/** Resolve deterministic candidates in strict product-priority order. */
export function resolveNextAction(input: NextActionInput): NextActionResult {
  const candidates: NextAction[] = [];

  const diagnosticMissing = input.assessmentStatus !== "completed" || input.stage.stage === "unknown";
  const hasPath = input.activePaths.length > 0;
  if (diagnosticMissing && !hasPath) {
    candidates.push(action("complete_diagnostic", { estimatedMinutes: 3 }));
  }

  if (input.activePaths.length === 0) {
    candidates.push(action("choose_income_path", { estimatedMinutes: 5 }));
  }

  const uninitializedPath = input.activePaths.find((path) => !path.initialized);
  if (uninitializedPath) {
    candidates.push(action("initialize_income_path", { pathId: uninitializedPath.id, estimatedMinutes: 5 }));
  }

  const pendingResult = input.pendingMissionResults[0];
  if (pendingResult) {
    candidates.push(action("record_mission_result", {
      pathId: pendingResult.pathId,
      projectId: pendingResult.projectId,
      missionId: pendingResult.id,
      estimatedMinutes: 3,
    }));
  }

  const mission = input.activeMissions[0];
  if (mission) {
    candidates.push(action("continue_mission", {
      pathId: mission.pathId,
      projectId: mission.projectId,
      missionId: mission.id,
      estimatedMinutes: mission.estimatedMinutes,
    }));
  }

  const unrecordedIncome = input.unrecordedIncome[0];
  if (unrecordedIncome) {
    candidates.push(action("record_income", {
      pathId: unrecordedIncome.pathId,
      projectId: unrecordedIncome.projectId,
      estimatedMinutes: 2,
    }));
  }

  if (diagnosticMissing && hasPath) {
    candidates.push(action("complete_diagnostic", { estimatedMinutes: 3 }));
  }

  const stageAction: Record<typeof input.stage.stage, NextActionKind> = {
    unknown: "complete_diagnostic",
    survive: "improve_cashflow",
    cashflow: "improve_cashflow",
    stability: "build_resilience",
    grow: "grow_income",
    scale: "optimize_scale",
    freedom: "review_freedom_plan",
  };
  // Stage-driven actions also carry the stage's own reasons (e.g. "income
  // below essential expenses") so the UI can explain the recommendation.
  candidates.push(action(stageAction[input.stage.stage], {}, input.stage.reasonCodes));

  const uniqueCandidates = candidates.filter(
    (candidate, index) => candidates.findIndex((item) => item.actionKind === candidate.actionKind) === index
  );

  return {
    primary: uniqueCandidates[0],
    secondary: uniqueCandidates.slice(1, 3),
    rulesVersion: NEXT_ACTION_RULES_VERSION,
  };
}
