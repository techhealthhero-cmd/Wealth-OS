import { describe, expect, it } from "vitest";

import { buildNextBestActionText } from "@/features/ai/lib/next-best-action";
import type { PriorityTool } from "@/features/ai/types";

// Minimal stand-in for useTranslation()'s `t` — returns the key itself so
// assertions can check exactly which key was used and how values were
// interpolated around it, without needing the real i18n dictionary loaded.
const t = (key: string) => key;

describe("buildNextBestActionText", () => {
  it("negative_cash_flow shows the suggested monthly reduction amount", () => {
    const priority: PriorityTool = { priorityType: "negative_cash_flow", severity: "critical", amountCents: 150000 };
    const { actionText, cta } = buildNextBestActionText(priority, t);
    expect(actionText).toContain("nextBestAction.actions.negative_cash_flow");
    expect(actionText).toContain("฿1,500.00");
    expect(actionText).toContain("nextBestAction.perMonth");
    expect(cta).toBe("/money/budget");
  });

  it("no_emergency_fund shows the amount needed, without a per-month suffix", () => {
    const priority: PriorityTool = { priorityType: "no_emergency_fund", severity: "high", amountCents: 800000 };
    const { actionText, cta } = buildNextBestActionText(priority, t);
    expect(actionText).toContain("฿8,000.00");
    expect(actionText).not.toContain("nextBestAction.perMonth");
    expect(cta).toBe("/plan/emergency-fund");
  });

  it("missed_goal includes the goal name and required monthly contribution", () => {
    const priority: PriorityTool = {
      priorityType: "missed_goal",
      severity: "medium",
      goalName: "บ้านหลังแรก",
      amountCents: 500000,
    };
    const { actionText } = buildNextBestActionText(priority, t);
    expect(actionText).toContain("บ้านหลังแรก");
    expect(actionText).toContain("฿5,000.00");
  });

  it("low_savings_rate shows a target percentage, not a currency amount", () => {
    const priority: PriorityTool = { priorityType: "low_savings_rate", severity: "medium", targetPercent: 20 };
    const { actionText } = buildNextBestActionText(priority, t);
    expect(actionText).toContain("20%");
    expect(actionText).not.toMatch(/฿/);
  });

  it("high_interest_debt shows the liability name and interest rate — never the outstanding balance as if it were a suggested payment", () => {
    const priority: PriorityTool = {
      priorityType: "high_interest_debt",
      severity: "high",
      goalName: "Credit Card A",
      amountCents: 2000000, // the liability's outstanding BALANCE — must never appear as a payment figure
      targetValue: 24, // the interest rate percent — this is what should actually be shown
    };
    const { actionText, cta } = buildNextBestActionText(priority, t);
    expect(actionText).toContain("Credit Card A");
    expect(actionText).toContain("24%");
    expect(actionText).not.toContain("฿20,000.00");
    expect(cta).toBe("/plan/debt");
  });

  it("high_interest_debt without a goal name falls back to the bare action label", () => {
    const priority: PriorityTool = { priorityType: "high_interest_debt", severity: "high", amountCents: 2000000 };
    const { actionText } = buildNextBestActionText(priority, t);
    expect(actionText).toBe("nextBestAction.actions.high_interest_debt");
  });

  it("an unknown priority type falls back to the bare action label and no CTA", () => {
    const priority: PriorityTool = { priorityType: "no_investment_contribution", severity: "low" };
    const { actionText, cta } = buildNextBestActionText(priority, t);
    expect(actionText).toBe("nextBestAction.actions.no_investment_contribution");
    expect(cta).toBe("/money/transactions");
  });
});
