import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { summarizeSkillEvidence } from "@/lib/earn/skill-evidence";
import { opportunityFit, opportunityPathType, opportunityReasons, smallExperimentFor } from "@/lib/earn/opportunities";

describe("Skills V2 — evidence summary (never XP)", () => {
  it("level = strongest dimension present, with per-dimension counts", () => {
    const m = summarizeSkillEvidence([
      { user_skill_id: "s1", dimension: "learning", occurred_at: "2026-09-01T00:00:00Z" },
      { user_skill_id: "s1", dimension: "action", occurred_at: "2026-09-05T00:00:00Z" },
      { user_skill_id: "s2", dimension: "learning", occurred_at: "2026-09-02T00:00:00Z" },
      { user_skill_id: "s3", dimension: "outcome", occurred_at: "2026-09-03T00:00:00Z" },
    ]);
    expect(m.get("s1")).toEqual({ counts: { learning: 1, action: 1, outcome: 0 }, level: "action", lastAt: "2026-09-05T00:00:00Z" });
    expect(m.get("s2")?.level).toBe("learning");
    expect(m.get("s3")?.level).toBe("outcome");
    expect(m.get("unknown")).toBeUndefined();
  });
});

describe("Opportunities V2", () => {
  it("never exposes the numeric score — only a label", () => {
    expect(opportunityFit(92)).toBe("strong");
    expect(opportunityFit(70)).toBe("strong");
    expect(opportunityFit(55)).toBe("worth_trying");
    expect(opportunityFit(10)).toBe("later");
  });

  it("maps catalog income models to path types and a small, cheap first experiment", () => {
    expect(opportunityPathType("product")).toBe("business_product");
    expect(opportunityPathType("project")).toBe("freelance_service");
    expect(smallExperimentFor("product")).toBe("presell_five");
    expect(smallExperimentFor("recurring")).toBe("offer_trial_month");
    expect(smallExperimentFor("hourly")).toBe("show_sample_five");
  });

  it("explains WHY with named reasons only when they are true", () => {
    expect(opportunityReasons({ matchedSkillCount: 2, timeToFirstIncome: "fast", difficulty: "easy", startupCostMaxMinor: 0 })).toEqual([
      "skill_match", "fast_income", "easy_start", "low_cost",
    ]);
    expect(opportunityReasons({ matchedSkillCount: 0, timeToFirstIncome: "slow", difficulty: "hard", startupCostMaxMinor: 5_000_000 })).toEqual([]);
  });
});

describe("localizeMission — template missions follow the current language", () => {
  it("renders a V2 template mission from its (path type, step) key, ignoring the stored creation-language title", async () => {
    const { localizeMission } = await import("@/features/earn/components/v2/helpers");
    const th = (await import("@/i18n/locales/th.json")).default;
    const en = (await import("@/i18n/locales/en.json")).default;
    const stored = { title: "หาลูกค้าที่อาจสนใจ 5 ราย", description: null, roadmap_step_key: "find_leads", income_path_id: "p1" };
    expect(localizeMission(en, "freelance_service", stored).title).toBe("Find 5 potential customers");
    expect(localizeMission(th, "freelance_service", stored).title).toBe("หาลูกค้าที่อาจสนใจ 5 ราย");
  });

  it("legacy / custom missions keep their stored title", async () => {
    const { localizeMission } = await import("@/features/earn/components/v2/helpers");
    const en = (await import("@/i18n/locales/en.json")).default;
    expect(localizeMission(en, null, { title: "outreach", income_path_id: null }).title).toBe("outreach");
    expect(localizeMission(en, "freelance_service", { title: "My own mission", roadmap_step_key: "unknown_step", income_path_id: "p1" }).title).toBe("My own mission");
  });
});

describe("actionablePathMissions — the V2 missions list", () => {
  it("keeps open missions and pending results (first), drops finished and skipped ones", async () => {
    const { actionablePathMissions } = await import("@/features/earn/components/v2/helpers");
    const m = (id: string, status: string, result_required = false, hasResult = false) => ({ id, status, result_required, hasResult });
    const out = actionablePathMissions([
      m("open", "not_started"),
      m("doing", "in_progress"),
      m("done", "completed"),
      m("recorded", "completed", true, true),
      m("skipped", "skipped"),
      m("pending", "completed", true, false),
    ]);
    expect(out.map((x) => x.id)).toEqual(["pending", "open", "doing"]);
  });
});

describe("Earn V2 result accessibility", () => {
  it("gives counter controls field-specific accessible names", () => {
    const source = readFileSync(resolve("src/features/earn/components/v2/mission-result-form.tsx"), "utf8");
    expect(source).toContain('t("earn.v2.missions.result.decreaseField")');
    expect(source).toContain('t("earn.v2.missions.result.increaseField")');
    expect(source).not.toContain('aria-label="−"');
    expect(source).not.toContain('aria-label="+"');
  });
});
