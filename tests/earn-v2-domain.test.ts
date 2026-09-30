import { describe, expect, it } from "vitest";

import {
  calculateBufferMonths,
  deriveIncomeReliability,
  deriveStageFacts,
  firstIncompleteStep,
  type DiagnosticAnswers,
} from "@/lib/earn/diagnostic";
import { calculateEarnStage } from "@/lib/earn/stage";
import { recommendExperiments } from "@/lib/earn/recommendations";
import {
  getMissionTemplate,
  listMissionTemplates,
  resultHasPositiveOutcome,
  validateMissionResult,
} from "@/lib/earn/mission-templates";
import { ROADMAP_TEMPLATES, getNextRoadmapStepKey, getRoadmapProgress } from "@/lib/earn/roadmap";
import { INCOME_PATH_TYPES } from "@/lib/earn/types";
import { diagnosticAnswersSchema, missionResultSchema } from "@/lib/validation/earn";

const BASE: DiagnosticAnswers = {
  incomeSituation: "none",
  monthlyIncomeMinor: 0,
  incomeIsSteady: null,
  essentialExpensesMinor: 1_200_000,
  availableResources: ["smartphone"],
  workPreferences: ["not_sure"],
  existingAbilities: ["none"],
  availableHoursPerWeek: 8,
  startingCapitalMinor: 0,
  startingCapitalCurrency: "THB",
  currentPriority: "quick_money",
};
const answers = (o: Partial<DiagnosticAnswers> = {}) => ({ ...BASE, ...o });
const stageOf = (a: DiagnosticAnswers, fund: number | null = null) => calculateEarnStage(deriveStageFacts(a, fund));

describe("diagnostic → Earn stage (the four users in the spec)", () => {
  it("User A: zero income → survive (first income)", () => {
    expect(stageOf(answers()).stage).toBe("survive");
  });

  it("irregular income below expenses → cashflow", () => {
    expect(stageOf(answers({ incomeSituation: "irregular", monthlyIncomeMinor: 800_000 })).stage).toBe("cashflow");
  });

  it("irregular income ABOVE expenses is still cashflow — not reliable", () => {
    const r = stageOf(answers({ incomeSituation: "irregular", monthlyIncomeMinor: 5_000_000 }));
    expect(r.stage).toBe("cashflow");
    expect(r.reasonCodes).toContain("income_not_reliable");
  });

  it("User B: salary covers expenses, no emergency fund data → stability (buffer unknown, never assumed)", () => {
    const r = stageOf(answers({ incomeSituation: "salary", monthlyIncomeMinor: 3_500_000 }));
    expect(r.stage).toBe("stability");
    expect(r.reasonCodes).toContain("buffer_unknown");
  });

  it("User C: salary + ≥3 months buffer → grow", () => {
    expect(stageOf(answers({ incomeSituation: "salary", monthlyIncomeMinor: 3_500_000 }), 3_600_000).stage).toBe("grow");
  });

  it("a questionnaire alone never reaches scale or freedom", () => {
    const facts = deriveStageFacts(answers({ incomeSituation: "business", monthlyIncomeMinor: 50_000_000, incomeIsSteady: true }), 100_000_000);
    expect(facts.hasRepeatableIncomeMechanism).toBe(false);
    expect(facts.hasFinancialIndependenceEvidence).toBe(false);
    expect(calculateEarnStage(facts).stage).toBe("grow");
  });

  it("self-employment counts as reliable only when the user says it is steady", () => {
    expect(deriveIncomeReliability({ incomeSituation: "freelance", monthlyIncomeMinor: 1, incomeIsSteady: null })).toBe("unreliable");
    expect(deriveIncomeReliability({ incomeSituation: "freelance", monthlyIncomeMinor: 1, incomeIsSteady: true })).toBe("reliable");
    expect(deriveIncomeReliability({ incomeSituation: "salary", monthlyIncomeMinor: 0, incomeIsSteady: null })).toBe("none");
  });

  it("buffer months: unknown stays null, never 0", () => {
    expect(calculateBufferMonths(null, 1_000_000)).toBeNull();
    expect(calculateBufferMonths(2_500_000, 1_000_000)).toBe(2.5);
    expect(calculateBufferMonths(500, 0)).toBeNull();
  });

  it("facts are marked self-reported", () => {
    expect(deriveStageFacts(answers(), null).monthlyIncome?.source).toBe("self_report");
  });

  it("resume: first incomplete step", () => {
    expect(firstIncompleteStep({})).toBe("income");
    expect(firstIncompleteStep({ incomeSituation: "none", monthlyIncomeMinor: 0 })).toBe("expenses");
    expect(firstIncompleteStep(answers())).toBeNull();
  });
});

describe("recommendExperiments — explainable, safe", () => {
  it("returns at most 3, each with reasons and no fake percentages", () => {
    const r = recommendExperiments(answers({ workPreferences: ["digital"], existingAbilities: ["design"], availableResources: ["computer", "smartphone"] }), "survive");
    expect(r.length).toBeGreaterThan(0);
    expect(r.length).toBeLessThanOrEqual(3);
    for (const e of r) {
      expect(e.reasonCodes.length).toBeGreaterThan(0);
      expect(Object.keys(e)).not.toContain("score");
    }
    expect(r[0].key).toBe("sample_and_show_five");
    expect(r[0].reasonCodes).toContain("matches_existing_skill");
  });

  it("never suggests investing while basic needs are not covered", () => {
    const r = recommendExperiments(answers({ currentPriority: "long_term_wealth", workPreferences: ["analysis"], existingAbilities: ["accounting"] }), "survive");
    expect(r.map((e) => e.pathType)).not.toContain("investment");
  });

  it("may suggest an investment PLAN once the foundation is ready", () => {
    const r = recommendExperiments(answers({ currentPriority: "long_term_wealth", workPreferences: ["analysis"], existingAbilities: ["accounting"] }), "grow");
    expect(r.map((e) => e.key)).toContain("investment_plan_basics");
  });

  it("never suggests an experiment that costs more than the user has", () => {
    const r = recommendExperiments(answers({ workPreferences: ["creative"], existingAbilities: ["cooking"], currentPriority: "build_business", startingCapitalMinor: 0 }), "cashflow");
    expect(r.map((e) => e.key)).not.toContain("presell_before_stock");
    const funded = recommendExperiments(answers({ workPreferences: ["creative"], existingAbilities: ["cooking"], currentPriority: "build_business", startingCapitalMinor: 300_000 }), "cashflow");
    expect(funded.map((e) => e.key)).toContain("presell_before_stock");
  });

  it("respects missing resources and available time", () => {
    expect(recommendExperiments(answers({ availableResources: [] }), "survive").every((e) => e.key !== "sample_and_show_five")).toBe(true);
    expect(recommendExperiments(answers({ availableHoursPerWeek: 0 }), "survive")).toEqual([]);
  });

  it("is deterministic", () => {
    const a = answers({ workPreferences: ["teaching", "people"], existingAbilities: ["languages"] });
    expect(recommendExperiments(a, "cashflow")).toEqual(recommendExperiments(a, "cashflow"));
  });
});

describe("mission templates", () => {
  it("every roadmap step of every path has exactly one mission template", () => {
    for (const type of INCOME_PATH_TYPES) {
      const steps = ROADMAP_TEMPLATES[type].steps.map((s) => s.key);
      expect(listMissionTemplates(type).map((t) => t.stepKey)).toEqual(steps);
    }
  });

  it("investment missions never require money outcomes (planning only)", () => {
    for (const t of listMissionTemplates("investment")) {
      expect(t.resultRequired).toBe(false);
      expect(t.mayProduceIncome).toBe(false);
    }
  });

  it("result validation: known fields, whole numbers, funnel never widens", () => {
    const t = getMissionTemplate("freelance_service", "find_leads")!;
    const ok = { counts: { contacted: 5, responses: 2, interested: 1 }, decision: null, notes: null };
    expect(validateMissionResult(t, ok)).toBeNull();
    expect(validateMissionResult(t, { ...ok, counts: { contacted: 3, responses: 5 } })).toBe("funnel_order");
    expect(validateMissionResult(t, { ...ok, counts: { customers: 1 } })).toBe("unknown_field");
    expect(validateMissionResult(t, { ...ok, counts: { contacted: 1.5 } })).toBe("invalid_count");
    expect(validateMissionResult(t, { ...ok, counts: { contacted: 0, responses: 0, interested: 0 } })).toBeNull();
  });

  it("positive outcome = the narrowest stage recorded something", () => {
    const t = getMissionTemplate("business_product", "first_sale")!;
    expect(resultHasPositiveOutcome(t, { offers_shown: 5, customers: 0 })).toBe(false);
    expect(resultHasPositiveOutcome(t, { offers_shown: 5, customers: 1 })).toBe(true);
  });
});

describe("roadmap progress", () => {
  it("unknown/null current step starts at the first step", () => {
    const p = getRoadmapProgress("freelance_service", null);
    expect(p).toMatchObject({ currentIndex: 0, currentStepKey: "foundation", nextStepKey: "proof_of_work", isComplete: false });
    expect(getRoadmapProgress("freelance_service", "renamed_step").currentStepKey).toBe("foundation");
  });

  it("middle and completion", () => {
    expect(getRoadmapProgress("career", "evidence")).toMatchObject({ currentIndex: 2, completedStepKeys: ["foundation", "skill_growth"] });
    expect(getRoadmapProgress("career", null, true)).toMatchObject({ isComplete: true, currentStepKey: null });
    expect(getNextRoadmapStepKey("career", "market_check")).toBeNull();
  });
});

describe("validation", () => {
  it("diagnostic answers still satisfy the foundation schema shape and reject nonsense", () => {
    expect(diagnosticAnswersSchema.safeParse(answers()).success).toBe(true);
    expect(diagnosticAnswersSchema.safeParse(answers({ essentialExpensesMinor: 0 })).success).toBe(false);
    expect(diagnosticAnswersSchema.safeParse({ ...answers(), currentPriority: "get_rich" }).success).toBe(false);
  });

  it("mission result schema", () => {
    expect(missionResultSchema.safeParse({ missionId: "11111111-1111-4111-8111-111111111111", counts: { contacted: 3 }, decision: "continue", notes: null }).success).toBe(true);
    expect(missionResultSchema.safeParse({ missionId: "x", counts: {}, decision: null, notes: null }).success).toBe(false);
  });
});

describe("mainConstraint", () => {
  it("income first when surviving, then time, money, tools", async () => {
    const { mainConstraint } = await import("@/lib/earn/diagnostic");
    expect(mainConstraint(answers(), "survive")).toBe("income");
    expect(mainConstraint(answers({ availableHoursPerWeek: 3 }), "cashflow")).toBe("time");
    expect(mainConstraint(answers(), "cashflow")).toBe("capital");
    expect(mainConstraint(answers({ startingCapitalMinor: 50_000, availableResources: ["time"] }), "grow")).toBe("resources");
    expect(mainConstraint(answers({ startingCapitalMinor: 50_000 }), "grow")).toBe("none");
  });
});
