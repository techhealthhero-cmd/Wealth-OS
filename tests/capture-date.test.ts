import { describe, expect, it } from "vitest";

import { applyCaptureDate, findSpokenDate, isValidCaptureDate, recentCaptureDates } from "@/lib/capture/capture-date";

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

  it("reads spoken dates in Thai and English", () => {
    const at = (text: string) => findSpokenDate(text, "2026-10-10")?.date ?? null;
    expect(at("วันที่ 8 ตุลาคม เงินมา 2000")).toBe("2026-10-08");
    expect(at("วันที่8ตุลาฉันซื้อข้าว 50")).toBe("2026-10-08");
    expect(at("วันที่แปดตุลา ข้าว 50")).toBe("2026-10-08");
    expect(at("วันที่ยี่สิบเอ็ด เดือนกันยายน")).toBe("2026-09-21");
    expect(at("8 ต.ค. ข้าว 50")).toBe("2026-10-08");
    expect(at("30 ก.ย. 2569 ค่าห้อง 4500")).toBe("2026-09-30");
    expect(at("on 3rd oct lunch 200")).toBe("2026-10-03");
    expect(at("october 3rd lunch 200")).toBe("2026-10-03");
  });

  it("spoken dates always land in the past and must exist", () => {
    const at = (text: string) => findSpokenDate(text, "2026-10-10")?.date ?? null;
    // Day only: this month, or last month if it hasn't come yet.
    expect(at("วันที่ 8 ข้าว 50")).toBe("2026-10-08");
    expect(at("วันที่ 25 ข้าว 50")).toBe("2026-09-25");
    // Month without a year that hasn't come yet → last year.
    expect(at("วันที่ 5 ธันวา ข้าว 50")).toBe("2025-12-05");
    expect(at("วันที่ 31 กุมภา")).toBeNull();
    // A period, not a day; plain amounts are never dates.
    expect(at("เงินแท็ก 1-15 ก.ย. เข้า 25,400")).toBeNull();
    expect(at("ข้าว 50 กาแฟ 60")).toBeNull();
    expect(at("oct 50 baht")).toBeNull();
  });

  it("rejects future or malformed days", () => {
    expect(isValidCaptureDate("2026-09-30", "2026-10-02")).toBe(true);
    expect(isValidCaptureDate("2026-10-02", "2026-10-02")).toBe(true);
    expect(isValidCaptureDate("2026-10-03", "2026-10-02")).toBe(false);
    expect(isValidCaptureDate("30/09/2026", "2026-10-02")).toBe(false);
    expect(isValidCaptureDate("", "2026-10-02")).toBe(false);
  });
});
