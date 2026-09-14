import { describe, expect, it } from "vitest";

import { computeUsageStatus } from "@/lib/billing/ai-usage";
import { getCurrentBillingPeriod, getNextResetDateString } from "@/lib/billing/period";

describe("computeUsageStatus — AI usage limit boundaries (STEP 17)", () => {
  it("under the limit: not reached, remaining is the difference", () => {
    const status = computeUsageStatus(5, 15, "2026-10-01");
    expect(status.limitReached).toBe(false);
    expect(status.remaining).toBe(10);
  });

  it("exactly at the limit: reached, zero remaining", () => {
    const status = computeUsageStatus(15, 15, "2026-10-01");
    expect(status.limitReached).toBe(true);
    expect(status.remaining).toBe(0);
  });

  it("over the limit (e.g. a race between two concurrent requests): still reached, remaining clamped at zero, never negative", () => {
    const status = computeUsageStatus(17, 15, "2026-10-01");
    expect(status.limitReached).toBe(true);
    expect(status.remaining).toBe(0);
  });

  it("zero usage against a plan's limit is never reached", () => {
    const status = computeUsageStatus(0, 15, "2026-10-01");
    expect(status.limitReached).toBe(false);
    expect(status.remaining).toBe(15);
  });

  it("passes the reset date through unchanged", () => {
    expect(computeUsageStatus(0, 15, "2026-11-01").resetDate).toBe("2026-11-01");
  });
});

describe("getCurrentBillingPeriod / getNextResetDateString — reset period (STEP 17)", () => {
  it("the period start is the 1st of the given month, end is the 1st of next month", () => {
    const { start, end } = getCurrentBillingPeriod(new Date(2026, 8, 15)); // Sep 15, 2026
    expect(start).toEqual(new Date(2026, 8, 1));
    expect(end).toEqual(new Date(2026, 9, 1));
  });

  it("rolls over the year boundary correctly (December -> January)", () => {
    const { end } = getCurrentBillingPeriod(new Date(2026, 11, 20)); // Dec 20, 2026
    expect(end).toEqual(new Date(2027, 0, 1));
  });

  it("reset date string matches the next month's 1st", () => {
    expect(getNextResetDateString(new Date(2026, 8, 15))).toBe("2026-10-01");
  });
});
