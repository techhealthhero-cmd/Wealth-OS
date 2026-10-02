import { describe, expect, it } from "vitest";

import { applyCaptureDate, isValidCaptureDate, recentCaptureDates } from "@/lib/capture/capture-date";

describe("capture date", () => {
  it("lists recent days oldest first, ending today (crosses month ends)", () => {
    expect(recentCaptureDates("2026-10-02", 4)).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
    expect(recentCaptureDates("2026-03-01", 2)).toEqual(["2026-02-28", "2026-03-01"]);
    expect(recentCaptureDates("2026-10-02")).toHaveLength(90);
  });

  it("the chosen day applies unless the sentence named its own day", () => {
    // No date words → parser said today → use the chosen 30 Sep.
    expect(applyCaptureDate("2026-10-02", "2026-10-02", "2026-09-30")).toBe("2026-09-30");
    // "เมื่อวาน" → parser said 1 Oct → keep it.
    expect(applyCaptureDate("2026-10-01", "2026-10-02", "2026-09-30")).toBe("2026-10-01");
    // Default (chosen = today) changes nothing.
    expect(applyCaptureDate("2026-10-02", "2026-10-02", "2026-10-02")).toBe("2026-10-02");
  });

  it("rejects future or malformed days", () => {
    expect(isValidCaptureDate("2026-09-30", "2026-10-02")).toBe(true);
    expect(isValidCaptureDate("2026-10-02", "2026-10-02")).toBe(true);
    expect(isValidCaptureDate("2026-10-03", "2026-10-02")).toBe(false);
    expect(isValidCaptureDate("30/09/2026", "2026-10-02")).toBe(false);
    expect(isValidCaptureDate("", "2026-10-02")).toBe(false);
  });
});
