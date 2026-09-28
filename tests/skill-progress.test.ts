import { describe, expect, it } from "vitest";

import { calculateSkillProgress } from "@/lib/skills/progress";
import { parseSkillViewMode } from "@/lib/skills/view-mode";

describe("calculateSkillProgress", () => {
  it("starts a new skill at level one", () => {
    expect(calculateSkillProgress(0)).toEqual({
      level: 1,
      progressPercent: 0,
      completedWorkCount: 0,
      nextLevel: 2,
      workUntilNextLevel: 3,
    });
  });

  it("advances at the completed-work thresholds", () => {
    expect(calculateSkillProgress(3)).toMatchObject({ level: 2, progressPercent: 0, workUntilNextLevel: 5 });
    expect(calculateSkillProgress(14)).toMatchObject({ level: 3, progressPercent: 86, workUntilNextLevel: 1 });
    expect(calculateSkillProgress(15)).toMatchObject({ level: 4, progressPercent: 0, workUntilNextLevel: 10 });
  });

  it("caps progress at the highest level and normalizes invalid counts", () => {
    expect(calculateSkillProgress(25)).toMatchObject({ level: 5, progressPercent: 100, nextLevel: null });
    expect(calculateSkillProgress(-4)).toMatchObject({ level: 1, completedWorkCount: 0 });
    expect(calculateSkillProgress(4.9)).toMatchObject({ level: 2, completedWorkCount: 4 });
  });
});

describe("parseSkillViewMode", () => {
  it("keeps a saved list preference and otherwise defaults to the grid", () => {
    expect(parseSkillViewMode("list")).toBe("list");
    expect(parseSkillViewMode("grid")).toBe("grid");
    expect(parseSkillViewMode("unexpected")).toBe("grid");
    expect(parseSkillViewMode(null)).toBe("grid");
  });
});
