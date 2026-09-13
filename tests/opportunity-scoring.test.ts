import { describe, expect, it } from "vitest";

import { scoreOpportunity, type OpportunityScoringContext, type OpportunityScoringInput } from "@/lib/financial/opportunity-scoring";

const baseOpportunity: OpportunityScoringInput = {
  requiredSkillCategories: ["web_development"],
  recommendedProficiency: "intermediate",
  estimatedStartupCostMinCents: 0,
  estimatedHoursPerWeekMin: 10,
  timeToFirstIncome: "fast",
  estimatedMonthlyIncomeMaxCents: 3000000,
};

const baseContext: OpportunityScoringContext = {
  skills: [],
  maxHoursPerWeek: 20,
  incomeGapCents: 1500000,
  maxStartupCostCents: null,
};

describe("scoreOpportunity — skill match", () => {
  it("scores highly with a strong skill match at or above the recommended proficiency", () => {
    const result = scoreOpportunity(baseOpportunity, {
      ...baseContext,
      skills: [{ category: "web_development", proficiencyLevel: "advanced", interestLevel: "high" }],
    });
    expect(result.breakdown.skillMatch).toBe(30);
    expect(result.missingRequirements).not.toContain("skill");
    expect(result.matchedSkillCategories).toEqual(["web_development"]);
  });

  it("gives partial credit for a weak skill match below the recommended proficiency", () => {
    const result = scoreOpportunity(baseOpportunity, {
      ...baseContext,
      skills: [{ category: "web_development", proficiencyLevel: "beginner", interestLevel: "medium" }],
    });
    expect(result.breakdown.skillMatch).toBeGreaterThan(0);
    expect(result.breakdown.skillMatch).toBeLessThan(30);
    expect(result.missingRequirements).toContain("skill");
  });

  it("scores zero skill match with no matching skill category at all", () => {
    const result = scoreOpportunity(baseOpportunity, {
      ...baseContext,
      skills: [{ category: "sales", proficiencyLevel: "expert", interestLevel: "high" }],
    });
    expect(result.breakdown.skillMatch).toBe(0);
    expect(result.missingRequirements).toContain("skill");
    expect(result.matchedSkillCategories).toEqual([]);
  });
});

describe("scoreOpportunity — available time", () => {
  it("scores full available-time credit when the user has plenty of time", () => {
    const result = scoreOpportunity(baseOpportunity, { ...baseContext, maxHoursPerWeek: 30 });
    expect(result.breakdown.availableTime).toBe(20);
  });

  it("scores zero and flags 'time' when the user has no available time at all", () => {
    const result = scoreOpportunity(baseOpportunity, { ...baseContext, maxHoursPerWeek: 0 });
    expect(result.breakdown.availableTime).toBe(0);
    expect(result.missingRequirements).toContain("time");
  });

  it("gives a neutral score when available time is unknown (not yet set)", () => {
    const result = scoreOpportunity(baseOpportunity, { ...baseContext, maxHoursPerWeek: null });
    expect(result.breakdown.availableTime).toBe(10);
    expect(result.missingRequirements).not.toContain("time");
  });
});

describe("scoreOpportunity — startup cost fit", () => {
  it("scores zero and flags 'budget' when the required minimum cost is far above the user's budget", () => {
    const result = scoreOpportunity(
      { ...baseOpportunity, estimatedStartupCostMinCents: 2000000 },
      { ...baseContext, maxStartupCostCents: 0 }
    );
    expect(result.breakdown.startupCostFit).toBe(0);
    expect(result.missingRequirements).toContain("budget");
  });

  it("scores full credit when the opportunity fits within the user's stated budget", () => {
    const result = scoreOpportunity(
      { ...baseOpportunity, estimatedStartupCostMinCents: 100000 },
      { ...baseContext, maxStartupCostCents: 500000 }
    );
    expect(result.breakdown.startupCostFit).toBe(10);
  });

  it("does not penalize when the user has stated no budget preference", () => {
    const result = scoreOpportunity(
      { ...baseOpportunity, estimatedStartupCostMinCents: 5000000 },
      { ...baseContext, maxStartupCostCents: null }
    );
    expect(result.breakdown.startupCostFit).toBe(10);
  });
});

describe("scoreOpportunity — income gap fit", () => {
  it("scores highly when the opportunity could plausibly close a high income gap", () => {
    const result = scoreOpportunity(
      { ...baseOpportunity, estimatedMonthlyIncomeMaxCents: 6000000 },
      { ...baseContext, incomeGapCents: 3000000 }
    );
    expect(result.breakdown.incomeGapFit).toBe(20);
  });

  it("gives partial credit when the opportunity only covers part of a large gap", () => {
    const result = scoreOpportunity(
      { ...baseOpportunity, estimatedMonthlyIncomeMaxCents: 1000000 },
      { ...baseContext, incomeGapCents: 4000000 }
    );
    expect(result.breakdown.incomeGapFit).toBe(5);
  });

  it("gives a neutral score when there is no target/gap to close", () => {
    const result = scoreOpportunity(baseOpportunity, { ...baseContext, incomeGapCents: null });
    expect(result.breakdown.incomeGapFit).toBe(10);
  });
});

describe("scoreOpportunity — multiple opportunities ranked", () => {
  it("ranks a strong overall match above a weak one", () => {
    const strongMatchContext: OpportunityScoringContext = {
      skills: [{ category: "web_development", proficiencyLevel: "expert", interestLevel: "high" }],
      maxHoursPerWeek: 30,
      incomeGapCents: 1000000,
      maxStartupCostCents: 1000000,
    };
    const weakMatchContext: OpportunityScoringContext = {
      skills: [{ category: "sales", proficiencyLevel: "beginner", interestLevel: "low" }],
      maxHoursPerWeek: 0,
      incomeGapCents: 1000000,
      maxStartupCostCents: 0,
    };

    const strong = scoreOpportunity(baseOpportunity, strongMatchContext);
    const weak = scoreOpportunity(baseOpportunity, weakMatchContext);
    expect(strong.totalScore).toBeGreaterThan(weak.totalScore);
  });
});

describe("scoreOpportunity — speed to first income is opportunity-inherent", () => {
  it("scores fast opportunities higher than slow ones, all else equal", () => {
    const fast = scoreOpportunity({ ...baseOpportunity, timeToFirstIncome: "fast" }, baseContext);
    const slow = scoreOpportunity({ ...baseOpportunity, timeToFirstIncome: "slow" }, baseContext);
    expect(fast.breakdown.speedToFirstIncome).toBeGreaterThan(slow.breakdown.speedToFirstIncome);
  });
});
