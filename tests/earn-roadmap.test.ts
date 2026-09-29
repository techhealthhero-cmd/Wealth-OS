import { describe, expect, it } from "vitest";

import { ROADMAP_TEMPLATES, ROADMAP_TEMPLATES_VERSION, getRoadmapTemplate } from "@/lib/earn/roadmap";
import { INCOME_PATH_TYPES } from "@/lib/earn/types";

describe("Earn roadmap templates", () => {
  it("defines one versioned template for every fixed V1 path type", () => {
    expect(Object.keys(ROADMAP_TEMPLATES).sort()).toEqual([...INCOME_PATH_TYPES].sort());
    for (const pathType of INCOME_PATH_TYPES) {
      expect(ROADMAP_TEMPLATES[pathType].version).toBe(ROADMAP_TEMPLATES_VERSION);
      expect(ROADMAP_TEMPLATES[pathType].steps.length).toBeGreaterThan(0);
    }
  });

  it("keeps ordered step keys unique per path", () => {
    for (const pathType of INCOME_PATH_TYPES) {
      const template = getRoadmapTemplate(pathType);
      expect(template.steps.map((step) => step.order)).toEqual(
        template.steps.map((_, index) => index + 1)
      );
      expect(new Set(template.steps.map((step) => step.key)).size).toBe(template.steps.length);
    }
  });

  it("marks investment as planning-only", () => {
    expect(ROADMAP_TEMPLATES.investment.guidanceMode).toBe("investment_planning_only");
  });

  it("returns a defensive copy", () => {
    const copy = getRoadmapTemplate("career");
    copy.steps[0].missionCategories.push("sell");
    expect(ROADMAP_TEMPLATES.career.steps[0].missionCategories).not.toContain("sell");
  });
});
