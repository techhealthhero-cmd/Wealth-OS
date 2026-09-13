import { describe, expect, it } from "vitest";

import { generateMissionSequence, summarizeMissionStatuses } from "@/lib/financial/income-missions";

describe("generateMissionSequence — correct sequence", () => {
  it("returns a fixed, ordered sequence starting with defining the offer and ending with growth missions", () => {
    const sequence = generateMissionSequence();
    expect(sequence[0].missionType).toBe("define_offer");
    expect(sequence[sequence.length - 1].missionType).toBe("raise_price");
    // sequence_order is strictly increasing with no gaps or duplicates
    const orders = sequence.map((m) => m.sequenceOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("is deterministic — calling it again (e.g. for a different opportunity) returns the same sequence", () => {
    const first = generateMissionSequence();
    const second = generateMissionSequence();
    expect(second).toEqual(first);
  });

  it("returns a fresh array each call so callers can't mutate the shared template", () => {
    const first = generateMissionSequence();
    first[0].targetQuantity = 999;
    const second = generateMissionSequence();
    expect(second[0].targetQuantity).not.toBe(999);
  });

  it("gives quantity-based missions (outreach, follow-up) a real target, and qualitative ones (define offer, set price) none", () => {
    const sequence = generateMissionSequence();
    const outreach = sequence.find((m) => m.missionType === "outreach");
    const defineOffer = sequence.find((m) => m.missionType === "define_offer");
    expect(outreach?.targetQuantity).toBe(5);
    expect(defineOffer?.targetQuantity).toBeNull();
  });
});

describe("summarizeMissionStatuses — progress counting", () => {
  it("counts a mix of statuses correctly", () => {
    const summary = summarizeMissionStatuses(["completed", "completed", "in_progress", "skipped", "not_started"]);
    expect(summary).toEqual({ total: 5, completed: 2, inProgress: 1, skipped: 1, notStarted: 1 });
  });

  it("handles an all-completed mission list", () => {
    const summary = summarizeMissionStatuses(["completed", "completed"]);
    expect(summary.completed).toBe(2);
    expect(summary.total).toBe(2);
  });

  it("handles an all-skipped mission list", () => {
    const summary = summarizeMissionStatuses(["skipped", "skipped", "skipped"]);
    expect(summary.skipped).toBe(3);
  });

  it("handles an empty mission list (e.g. no opportunity chosen yet)", () => {
    const summary = summarizeMissionStatuses([]);
    expect(summary).toEqual({ total: 0, completed: 0, inProgress: 0, skipped: 0, notStarted: 0 });
  });
});
