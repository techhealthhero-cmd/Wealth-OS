import { describe, expect, it } from "vitest";

import {
  COVER_DECORATIONS,
  COVER_THEMES,
  DEFAULT_COVER_PREFERENCES,
  coverPreferencesSchema,
  getCoverTheme,
  resolveCoverPreferences,
} from "@/lib/notebook-covers/config";
import { OPENING_TIMINGS, getInAppVariant, getLaunchVariant, totalOpeningDuration } from "@/lib/notebook-covers/playback";
import { OPENING_MODES } from "@/lib/notebook-covers/config";
import fs from "node:fs";
import th from "@/i18n/locales/th.json";
import en from "@/i18n/locales/en.json";

describe("notebook cover catalogue", () => {
  it("has the five brief themes with the brief's primary colours", () => {
    expect(COVER_THEMES.map((t) => [t.id, t.base])).toEqual([
      ["forest", "#204d3d"],
      ["vintage", "#70462f"],
      ["cream", "#f5ebd8"],
      ["midnight", "#233b53"],
      ["sakura", "#dfa7a5"],
    ]);
  });

  it("ids fit the database check pattern (migration 0040)", () => {
    for (const id of [...COVER_THEMES.map((t) => t.id), ...COVER_DECORATIONS.map((d) => d.id)]) {
      expect(id).toMatch(/^[a-z0-9-]{1,32}$/);
    }
  });

  it("every theme and sticker has Thai and English copy", () => {
    for (const dict of [th, en]) {
      for (const t of COVER_THEMES) {
        expect(dict.notebookCover.themes[t.id].name).toBeTruthy();
        expect(dict.notebookCover.themes[t.id].description).toBeTruthy();
      }
      for (const d of COVER_DECORATIONS) {
        expect(dict.notebookCover.decorations[d.id]).toBeTruthy();
        expect(dict.notebookCover.categories[d.category]).toBeTruthy();
      }
    }
  });

  it("falls back to the default theme for an unknown id", () => {
    expect(getCoverTheme("does-not-exist").id).toBe("forest");
    expect(getCoverTheme(null).id).toBe("forest");
  });
});

describe("resolveCoverPreferences", () => {
  it("uses safe defaults when nothing is stored (unmigrated database / new user)", () => {
    expect(resolveCoverPreferences(null)).toEqual(DEFAULT_COVER_PREFERENCES);
    expect(resolveCoverPreferences({})).toEqual(DEFAULT_COVER_PREFERENCES);
  });

  it("keeps valid stored values", () => {
    expect(
      resolveCoverPreferences({
        cover_theme: "midnight",
        cover_decorations: ["cat"],
        cover_name: "สมุดเงินของฉัน",
        notebook_opening_mode: "first_time",
      })
    ).toEqual({ theme: "midnight", decorations: ["cat"], name: "สมุดเงินของฉัน", openingMode: "first_time" });
  });

  it("drops unknown stickers, extra stickers, unknown themes and blank names", () => {
    expect(
      resolveCoverPreferences({
        cover_theme: "neon",
        cover_decorations: ["rocket", "leaf", "cat"],
        cover_name: "   ",
      })
    ).toEqual({ theme: "forest", decorations: ["leaf"], name: null, openingMode: "quick" });
  });
});

describe("coverPreferencesSchema (server-side validation)", () => {
  const valid = { theme: "sakura", decorations: ["coffee"], name: "  Puttipong ", openingMode: "quick" };

  it("accepts a valid payload and trims the name", () => {
    const parsed = coverPreferencesSchema.parse(valid);
    expect(parsed.name).toBe("Puttipong");
  });

  it("turns an empty name into null", () => {
    expect(coverPreferencesSchema.parse({ ...valid, name: "" }).name).toBeNull();
  });

  it("rejects unknown themes, unknown or too many stickers, and over-long names", () => {
    expect(coverPreferencesSchema.safeParse({ ...valid, theme: "gold" }).success).toBe(false);
    expect(coverPreferencesSchema.safeParse({ ...valid, decorations: ["unicorn"] }).success).toBe(false);
    expect(coverPreferencesSchema.safeParse({ ...valid, decorations: ["leaf", "cat"] }).success).toBe(false);
    expect(coverPreferencesSchema.safeParse({ ...valid, name: "x".repeat(25) }).success).toBe(false);
  });
});

describe("opening modes — fresh app launch", () => {
  it("defaults to the quick opening for anyone without a saved choice (new or existing user, unmigrated DB)", () => {
    expect(DEFAULT_COVER_PREFERENCES.openingMode).toBe("quick");
    expect(resolveCoverPreferences({}).openingMode).toBe("quick");
    expect(resolveCoverPreferences({ notebook_opening_mode: "bogus" }).openingMode).toBe("quick");
    expect(getLaunchVariant({ mode: "quick", firstPlayed: true })).toBe("quick");
  });

  it("full plays on every launch; off never does", () => {
    expect(getLaunchVariant({ mode: "full", firstPlayed: false })).toBe("full");
    expect(getLaunchVariant({ mode: "full", firstPlayed: true })).toBe("full");
    expect(getLaunchVariant({ mode: "off", firstPlayed: false })).toBeNull();
  });

  it("first_time plays the full opening once, then nothing", () => {
    expect(getLaunchVariant({ mode: "first_time", firstPlayed: false })).toBe("full");
    expect(getLaunchVariant({ mode: "first_time", firstPlayed: true })).toBeNull();
  });

  it("the schema accepts exactly the four modes", () => {
    expect(OPENING_MODES).toEqual(["full", "quick", "first_time", "off"]);
    const base = { theme: "forest", decorations: [], name: null };
    for (const m of OPENING_MODES) expect(coverPreferencesSchema.safeParse({ ...base, openingMode: m }).success).toBe(true);
    expect(coverPreferencesSchema.safeParse({ ...base, openingMode: "slow" }).success).toBe(false);
  });

  it("the migration's check list matches the code's modes, default quick", () => {
    const sql = fs.readFileSync("supabase/migrations/0040_notebook_cover.sql", "utf8");
    expect(sql).toContain("notebook_opening_mode text not null default 'quick'");
    expect(sql).toContain("('full', 'quick', 'first_time', 'off')");
  });
});

describe("in-app openings", () => {
  it("onboarding always shows the full opening", () => {
    for (const m of OPENING_MODES) expect(getInAppVariant("onboarding", m)).toBe("full");
  });

  it("a saved cover change opens quickly unless animations are off", () => {
    expect(getInAppVariant("cover-change", "full")).toBe("quick");
    expect(getInAppVariant("cover-change", "quick")).toBe("quick");
    expect(getInAppVariant("cover-change", "off")).toBeNull();
  });

  it("preview plays the mode asked for, regardless of the saved mode", () => {
    expect(getInAppVariant({ preview: "full" }, "off")).toBe("full");
    expect(getInAppVariant({ preview: "quick" }, "full")).toBe("quick");
    expect(getInAppVariant({ preview: "first_time" }, "quick")).toBe("full");
    expect(getInAppVariant({ preview: "off" }, "quick")).toBeNull();
  });
});

describe("opening timings", () => {
  it("full stays within 1.2–1.8 s and quick is about 1 s", () => {
    expect(OPENING_TIMINGS.full.open).toBeGreaterThanOrEqual(600);
    expect(OPENING_TIMINGS.full.open).toBeLessThanOrEqual(800);
    expect(totalOpeningDuration("full")).toBeGreaterThanOrEqual(1200);
    expect(totalOpeningDuration("full")).toBeLessThanOrEqual(1800);
    expect(totalOpeningDuration("quick")).toBe(1000);
  });

  it("the CSS keyframes use the same total durations", () => {
    const css = fs.readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain(`--nb-duration: ${totalOpeningDuration("full")}ms`);
    expect(css).toContain(`--nb-duration: ${totalOpeningDuration("quick")}ms`);
  });
});
