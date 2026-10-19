import { describe, expect, it } from "vitest";

import { pickSparklineLabels } from "@/features/dashboard/lib/sparkline-labels";

describe("pickSparklineLabels", () => {
  it("keeps every label when there are few enough", () => {
    expect(pickSparklineLabels(["May", "Jun", "Jul"], 4)).toEqual(["May", "Jun", "Jul"]);
    expect(pickSparklineLabels([], 4)).toEqual([]);
  });

  it("thins evenly, always keeping the first and the current (last) label", () => {
    expect(pickSparklineLabels(["May", "Jun", "Jul", "Aug", "Sep", "Oct"], 4)).toEqual(["May", "Jul", "Aug", "Oct"]);
    expect(pickSparklineLabels(["a", "b", "c", "d", "e"], 2)).toEqual(["a", "e"]);
  });

  it("handles degenerate limits", () => {
    expect(pickSparklineLabels(["a", "b", "c"], 1)).toEqual(["c"]);
    expect(pickSparklineLabels(["a", "b", "c"], 0)).toEqual([]);
  });

  it("never duplicates a label", () => {
    const picked = pickSparklineLabels(["a", "b", "c", "d", "e", "f", "g"], 6);
    expect(new Set(picked).size).toBe(picked.length);
    expect(picked[0]).toBe("a");
    expect(picked.at(-1)).toBe("g");
  });
});
