import { describe, expect, it } from "vitest";

import { calculateIncomeProfile, hasIncomeConcentrationRisk, type IncomeProfileInputs } from "@/lib/financial/income-profile";

function source(
  name: string,
  expectedMonthlyIncomeCents: number,
  stability: "stable" | "variable",
  isActive = true
) {
  return { name, expectedMonthlyIncomeCents, stability, isActive };
}

describe("calculateIncomeProfile — stability", () => {
  it("rates income as stable when every active source is stable", () => {
    const profile = calculateIncomeProfile({
      currentMonthIncomeCents: 3000000,
      trailingMonthsIncomeCents: [3000000],
      sources: [source("Salary", 3000000, "stable")],
    });
    expect(profile.stability).toBe("stable");
    expect(profile.stableIncomeCents).toBe(3000000);
    expect(profile.variableIncomeCents).toBe(0);
  });

  it("rates income as variable when every active source is variable", () => {
    const profile = calculateIncomeProfile({
      currentMonthIncomeCents: 1000000,
      trailingMonthsIncomeCents: [800000],
      sources: [source("Freelance", 1000000, "variable")],
    });
    expect(profile.stability).toBe("variable");
  });

  it("rates income as mixed when both stable and variable sources are active", () => {
    const profile = calculateIncomeProfile({
      currentMonthIncomeCents: 4000000,
      trailingMonthsIncomeCents: [4000000],
      sources: [source("Salary", 3000000, "stable"), source("Freelance", 1000000, "variable")],
    });
    expect(profile.stability).toBe("mixed");
  });

  it("rates income as unknown when there are no active sources", () => {
    const profile = calculateIncomeProfile({
      currentMonthIncomeCents: 0,
      trailingMonthsIncomeCents: [],
      sources: [source("Old freelance gig", 500000, "variable", false)],
    });
    expect(profile.stability).toBe("unknown");
    expect(profile.activeSourceCount).toBe(0);
  });
});

describe("calculateIncomeProfile — concentration", () => {
  it("flags concentration risk when one source is 90%+ of expected income", () => {
    const profile = calculateIncomeProfile({
      currentMonthIncomeCents: 3200000,
      trailingMonthsIncomeCents: [3200000],
      sources: [source("Salary", 3000000, "stable"), source("Side gig", 200000, "variable")],
    });
    expect(profile.concentrationPercent).toBeCloseTo(93.75, 1);
    expect(hasIncomeConcentrationRisk(profile)).toBe(true);
  });

  it("does not flag concentration risk when income is reasonably split", () => {
    const profile = calculateIncomeProfile({
      currentMonthIncomeCents: 4000000,
      trailingMonthsIncomeCents: [4000000],
      sources: [source("Salary", 2000000, "stable"), source("Freelance", 2000000, "variable")],
    });
    expect(profile.concentrationPercent).toBe(50);
    expect(hasIncomeConcentrationRisk(profile)).toBe(false);
  });

  it("reports null concentration when there is no active source with expected income", () => {
    const profile = calculateIncomeProfile({
      currentMonthIncomeCents: 0,
      trailingMonthsIncomeCents: [],
      sources: [],
    });
    expect(profile.concentrationPercent).toBeNull();
    expect(hasIncomeConcentrationRisk(profile)).toBe(false);
  });
});

describe("calculateIncomeProfile — growth", () => {
  it("computes month-over-month growth vs. the trailing average", () => {
    const profile = calculateIncomeProfile({
      currentMonthIncomeCents: 4000000,
      trailingMonthsIncomeCents: [3000000, 3200000, 3400000], // avg = 3,200,000
      sources: [source("Salary", 3500000, "stable")],
    });
    expect(profile.averageMonthlyIncomeCents).toBe(3200000);
    expect(profile.momGrowthPercent).toBeCloseTo(25, 0);
  });

  it("reports null growth when there is no trailing history to compare against", () => {
    const profile = calculateIncomeProfile({
      currentMonthIncomeCents: 3000000,
      trailingMonthsIncomeCents: [],
      sources: [source("Salary", 3000000, "stable")],
    });
    expect(profile.momGrowthPercent).toBeNull();
    expect(profile.averageMonthlyIncomeCents).toBe(3000000);
  });
});

describe("calculateIncomeProfile — edge cases", () => {
  it("handles zero income with no history at all", () => {
    const inputs: IncomeProfileInputs = { currentMonthIncomeCents: 0, trailingMonthsIncomeCents: [], sources: [] };
    const profile = calculateIncomeProfile(inputs);
    expect(profile.hasIncomeHistory).toBe(false);
    expect(profile.currentMonthlyIncomeCents).toBe(0);
    expect(profile.primarySource).toBeNull();
  });

  it("picks the highest-expected-income active source as primary, ignoring inactive sources", () => {
    const profile = calculateIncomeProfile({
      currentMonthIncomeCents: 3000000,
      trailingMonthsIncomeCents: [3000000],
      sources: [
        source("Old job (inactive)", 5000000, "stable", false),
        source("Salary", 3000000, "stable"),
        source("Side gig", 500000, "variable"),
      ],
    });
    expect(profile.primarySource).toBe("Salary");
    expect(profile.activeSourceCount).toBe(2);
  });
});
