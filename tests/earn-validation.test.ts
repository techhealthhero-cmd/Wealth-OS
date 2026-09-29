import { describe, expect, it } from "vitest";

import { earnAssessmentSnapshotSchema, incomePathSchema } from "@/lib/validation/earn";

describe("Earn foundation validation", () => {
  it("accepts a completed assessment snapshot with expense provenance", () => {
    expect(earnAssessmentSnapshotSchema.parse({
      rules_version: "earn-stage-v1",
      answers: {
        incomeSituation: "irregular",
        availableResources: ["laptop"],
        workPreferences: ["online"],
        existingAbilities: ["teaching"],
        availableHoursPerWeek: 10,
        startingCapitalMinor: 0,
        startingCapitalCurrency: "THB",
        currentPriority: "first_income",
      },
      calculated_stage: "cashflow",
      reason_codes: ["income_not_reliable"],
      essential_expenses_amount: 20_000,
      essential_expenses_currency: "THB",
      essential_expenses_source: "self_report",
      completed_at: "2026-09-30T00:00:00.000Z",
    }).essential_expenses_source).toBe("self_report");
  });

  it("only accepts the four fixed V1 income path types", () => {
    expect(incomePathSchema.safeParse({
      path_type: "freelance_service",
      title: "Tutoring",
      roadmap_template_version: "earn-roadmap-v1",
    }).success).toBe(true);
    expect(incomePathSchema.safeParse({
      path_type: "skill",
      title: "Teaching",
      roadmap_template_version: "earn-roadmap-v1",
    }).success).toBe(false);
  });
});
