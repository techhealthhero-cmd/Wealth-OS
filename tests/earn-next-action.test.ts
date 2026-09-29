import { describe, expect, it } from "vitest";

import { NEXT_ACTION_RULES_VERSION, resolveNextAction } from "@/lib/earn/next-action";
import type { EarnStageResult, NextActionInput } from "@/lib/earn/types";

const growStage: EarnStageResult = {
  stage: "grow",
  reasonCodes: ["foundation_ready_for_growth"],
  rulesVersion: "earn-stage-v1",
  confidence: "sufficient",
};

function input(overrides: Partial<NextActionInput> = {}): NextActionInput {
  return {
    assessmentStatus: "completed",
    stage: growStage,
    activePaths: [{ id: "path-1", status: "active", initialized: true }],
    pendingMissionResults: [],
    activeMissions: [],
    unrecordedIncome: [],
    ...overrides,
  };
}

describe("Next Action Engine V1", () => {
  it("always returns exactly one primary action and no more than two secondary actions", () => {
    const result = resolveNextAction(input({
      pendingMissionResults: [{
        id: "mission-result",
        pathId: "path-1",
        resultRequired: true,
        hasResult: false,
        estimatedMinutes: 10,
      }],
      activeMissions: [{ id: "mission-next", pathId: "path-1", estimatedMinutes: 20 }],
      unrecordedIncome: [{ pathId: "path-1" }],
    }));

    expect(result.primary).toBeDefined();
    expect(result.secondary.length).toBeLessThanOrEqual(2);
    expect(result.rulesVersion).toBe(NEXT_ACTION_RULES_VERSION);
  });

  it("incomplete diagnostic outranks path creation", () => {
    const result = resolveNextAction(input({
      assessmentStatus: "in_progress",
      stage: { ...growStage, stage: "unknown", confidence: "insufficient" },
      activePaths: [],
    }));
    expect(result.primary.actionKind).toBe("complete_diagnostic");
    expect(result.secondary[0].actionKind).toBe("choose_income_path");
  });

  it("supports multiple active income paths and selects the first uninitialized path", () => {
    const result = resolveNextAction(input({
      activePaths: [
        { id: "career", status: "active", initialized: true },
        { id: "business", status: "active", initialized: false },
      ],
    }));
    expect(result.primary).toMatchObject({ actionKind: "initialize_income_path", pathId: "business" });
  });

  it("pending mission result outranks a new active mission", () => {
    const result = resolveNextAction(input({
      pendingMissionResults: [{
        id: "completed-mission",
        pathId: "path-1",
        resultRequired: true,
        hasResult: false,
        estimatedMinutes: null,
      }],
      activeMissions: [{ id: "new-mission", pathId: "path-1", estimatedMinutes: 30 }],
    }));
    expect(result.primary).toMatchObject({
      actionKind: "record_mission_result",
      missionId: "completed-mission",
    });
    expect(result.secondary[0]).toMatchObject({ actionKind: "continue_mission", missionId: "new-mission" });
  });

  it("does not crash for an existing user with no Earn V2 data", () => {
    const result = resolveNextAction(input({
      assessmentStatus: "not_started",
      stage: {
        stage: "unknown",
        reasonCodes: ["diagnostic_incomplete"],
        rulesVersion: "earn-stage-v1",
        confidence: "insufficient",
      },
      activePaths: [],
    }));
    expect(result.primary.actionKind).toBe("complete_diagnostic");
  });
});
