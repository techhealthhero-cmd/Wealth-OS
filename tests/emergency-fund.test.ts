import { describe, expect, it } from "vitest";

import {
  calculateEmergencyFundCompletion,
  calculateEmergencyFundProgress,
  calculateEmergencyFundTarget,
  calculateMonthsProtected,
} from "@/lib/financial/emergency-fund";

describe("calculateEmergencyFundTarget", () => {
  it("multiplies essential monthly expenses by the target months", () => {
    expect(calculateEmergencyFundTarget(1500000, 6, null)).toBe(9000000);
  });

  it("uses a flat custom target when months isn't set", () => {
    expect(calculateEmergencyFundTarget(1500000, null, 5000000)).toBe(5000000);
  });

  it("edge case: neither months nor custom amount set returns 0", () => {
    expect(calculateEmergencyFundTarget(1500000, null, null)).toBe(0);
  });
});

describe("calculateMonthsProtected", () => {
  it("divides current balance by essential monthly expenses", () => {
    expect(calculateMonthsProtected(4500000, 1500000)).toBeCloseTo(3);
  });

  it("edge case: essential monthly expenses of 0 returns 0, not Infinity", () => {
    expect(calculateMonthsProtected(1000000, 0)).toBe(0);
  });

  it("edge case: no emergency fund saved at all", () => {
    expect(calculateMonthsProtected(0, 1500000)).toBe(0);
  });
});

describe("calculateEmergencyFundProgress", () => {
  it("computes percent of target reached", () => {
    expect(calculateEmergencyFundProgress(3000000, 9000000)).toBeCloseTo(33.33, 1);
  });

  it("caps at 100 once target is reached or exceeded", () => {
    expect(calculateEmergencyFundProgress(12000000, 9000000)).toBe(100);
  });

  it("edge case: target of 0 returns 0", () => {
    expect(calculateEmergencyFundProgress(100, 0)).toBe(0);
  });
});

describe("calculateEmergencyFundCompletion", () => {
  const today = new Date("2026-01-01T00:00:00Z");

  it("projects a future date at a flat contribution rate", () => {
    const result = calculateEmergencyFundCompletion(0, 6000000, 1000000, today);
    expect(result).not.toBeNull();
    expect(result!.getTime()).toBeGreaterThan(today.getTime());
  });

  it("returns today once the target is already met", () => {
    expect(calculateEmergencyFundCompletion(6000000, 6000000, 0, today)).toEqual(today);
  });

  it("edge case: zero contribution and target not met returns null", () => {
    expect(calculateEmergencyFundCompletion(0, 6000000, 0, today)).toBeNull();
  });
});
