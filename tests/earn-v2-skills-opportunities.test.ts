import { describe, expect, it } from "vitest";

import { summarizeSkillEvidence } from "@/lib/earn/skill-evidence";
import { opportunityFit, opportunityPathType, opportunityReasons, smallExperimentFor } from "@/lib/earn/opportunities";

describe("Skills V2 — evidence summary (never XP)", () => {
  it("level = strongest dimension present, with per-dimension counts", () => {
    const m = summarizeSkillEvidence([
      { user_skill_id: "s1", dimension: "learning", occurred_at: "2026-09-01T00:00:00Z" },
      { user_skill_id: "s1", dimension: "action", occurred_at: "2026-09-05T00:00:00Z" },
      { user_skill_id: "s2", dimension: "learning", occurred_at: "2026-09-02T00:00:00Z" },
      { user_skill_id: "s3", dimension: "outcome", occurred_at: "2026-09-03T00:00:00Z" },
    ]);
    expect(m.get("s1")).toEqual({ counts: { learning: 1, action: 1, outcome: 0 }, level: "action", lastAt: "2026-09-05T00:00:00Z" });
    expect(m.get("s2")?.level).toBe("learning");
    expect(m.get("s3")?.level).toBe("outcome");
    expect(m.get("unknown")).toBeUndefined();
  });
});

describe("Opportunities V2", () => {
  it("never exposes the numeric score — only a label", () => {
    expect(opportunityFit(92)).toBe("strong");
    expect(opportunityFit(70)).toBe("strong");
    expect(opportunityFit(55)).toBe("worth_trying");
    expect(opportunityFit(10)).toBe("later");
  });

  it("maps catalog income models to path types and a small, cheap first experiment", () => {
    expect(opportunityPathType("product")).toBe("business_product");
    expect(opportunityPathType("project")).toBe("freelance_service");
    expect(smallExperimentFor("product")).toBe("presell_five");
    expect(smallExperimentFor("recurring")).toBe("offer_trial_month");
    expect(smallExperimentFor("hourly")).toBe("show_sample_five");
  });

  it("explains WHY with named reasons only when they are true", () => {
    expect(opportunityReasons({ matchedSkillCount: 2, timeToFirstIncome: "fast", difficulty: "easy", startupCostMaxMinor: 0 })).toEqual([
      "skill_match", "fast_income", "easy_start", "low_cost",
    ]);
    expect(opportunityReasons({ matchedSkillCount: 0, timeToFirstIncome: "slow", difficulty: "hard", startupCostMaxMinor: 5_000_000 })).toEqual([]);
  });
});
