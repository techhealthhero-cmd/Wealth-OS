import { describe, expect, it } from "vitest";

import {
  COVER_DECORATIONS,
  COVER_THEMES,
  DEFAULT_COVER_PREFERENCES,
  coverPreferencesSchema,
  getCoverTheme,
  resolveCoverPreferences,
} from "@/lib/notebook-covers/config";
import { OPENING_TIMINGS, getOpeningMode, totalOpeningDuration } from "@/lib/notebook-covers/playback";
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
        opening_animation_enabled: false,
      })
    ).toEqual({ theme: "midnight", decorations: ["cat"], name: "สมุดเงินของฉัน", openingAnimationEnabled: false });
  });

  it("drops unknown stickers, extra stickers, unknown themes and blank names", () => {
    expect(
      resolveCoverPreferences({
        cover_theme: "neon",
        cover_decorations: ["rocket", "leaf", "cat"],
        cover_name: "   ",
      })
    ).toEqual({ theme: "forest", decorations: ["leaf"], name: null, openingAnimationEnabled: true });
  });
});

describe("coverPreferencesSchema (server-side validation)", () => {
  const valid = { theme: "sakura", decorations: ["coffee"], name: "  Puttipong ", openingAnimationEnabled: true };

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

describe("opening animation playback rules", () => {
  it("plays after onboarding / a cover change only when the user's switch is on", () => {
    for (const reason of ["onboarding", "cover-change"] as const) {
      expect(getOpeningMode({ reason, enabled: true, prefersReducedMotion: false })).toBe("full");
      expect(getOpeningMode({ reason, enabled: false, prefersReducedMotion: false })).toBe("none");
    }
  });

  it("an explicit 'Open my journal' tap always plays, even with the switch off", () => {
    expect(getOpeningMode({ reason: "user-replay", enabled: false, prefersReducedMotion: false })).toBe("full");
  });

  it("honours prefers-reduced-motion with the short variant", () => {
    expect(getOpeningMode({ reason: "onboarding", enabled: true, prefersReducedMotion: true })).toBe("reduced");
    expect(getOpeningMode({ reason: "user-replay", enabled: false, prefersReducedMotion: true })).toBe("reduced");
  });

  it("stays within the brief's time budget", () => {
    expect(OPENING_TIMINGS.full.closed).toBeLessThanOrEqual(350);
    expect(OPENING_TIMINGS.full.open).toBeGreaterThanOrEqual(600);
    expect(OPENING_TIMINGS.full.open).toBeLessThanOrEqual(800);
    expect(totalOpeningDuration("full")).toBeLessThanOrEqual(1800);
    expect(totalOpeningDuration("reduced")).toBeLessThan(600);
  });
});
