import { z } from "zod";

/**
 * Notebook cover catalogue (Notebook Cover & Opening Experience, 2026-10-09).
 *
 * Data-driven on purpose: a new cover is one more entry in COVER_THEMES —
 * NotebookCover reads every colour from here and never special-cases a
 * theme id. Cover colours are fixed per theme and independent of the app's
 * light/dark mode (a green leather journal looks the same at night); the
 * cover is an object on the desk, not part of the page's colour scheme.
 *
 * Pure module (no React, no server-only): shared by the server action's
 * validation, the client pickers and the unit tests.
 */

export interface CoverTheme {
  id: string;
  /** Leather/linen base colour (the brief's "primary colour"). */
  base: string;
  /** Shade toward the spine and edges. */
  shade: string;
  /** Embossing/foil colours: highlight → mid → deep. */
  foil: [string, string, string];
  /** Metal corner protectors (null = no corners, e.g. the linen cover). */
  corner: [string, string] | null;
  /** Elastic strap colour (null = no strap). */
  strap: string | null;
  /** Ribbon bookmark colour. */
  ribbon: string;
  /** Page-edge colour of the paper block. */
  paper: string;
  /** Grain strength 0–1 (linen is subtler than leather). */
  grain: number;
  /** Leather grain vs woven linen texture. */
  material: "leather" | "linen";
  /**
   * Optional raster texture (e.g. a photographed leather swatch under
   * /public/covers/) laid over the drawn cover. Unused by the first five
   * themes, which are pure SVG; the slot exists so a richer asset can be
   * added later without touching the component.
   */
  textureImage?: string;
}

export const COVER_THEMES = [
  {
    id: "forest",
    base: "#204d3d",
    shade: "#123227",
    foil: ["#f3dfa6", "#c9a45c", "#8a6a2e"],
    corner: ["#e8cf8e", "#9b7a3c"],
    strap: "#173a2e",
    ribbon: "#b8925a",
    paper: "#efe5cf",
    grain: 0.55,
    material: "leather",
  },
  {
    id: "vintage",
    base: "#70462f",
    shade: "#45291a",
    foil: ["#edd49a", "#bb924f", "#7d5a26"],
    corner: ["#e2c27f", "#8c6a33"],
    strap: "#4a2d1d",
    ribbon: "#2f5a46",
    paper: "#ecdfc4",
    grain: 0.7,
    material: "leather",
  },
  {
    id: "cream",
    base: "#f5ebd8",
    shade: "#dccbaa",
    foil: ["#c9ad78", "#9d7f4c", "#6f5530"],
    corner: null,
    strap: null,
    ribbon: "#c9a45c",
    paper: "#fbf6ea",
    grain: 0.3,
    material: "linen",
  },
  {
    id: "midnight",
    base: "#233b53",
    shade: "#132436",
    foil: ["#f0d9a0", "#c39c58", "#86652c"],
    corner: ["#e3c587", "#8f6f35"],
    strap: "#1a2d40",
    ribbon: "#c39c58",
    paper: "#eee5d1",
    grain: 0.5,
    material: "leather",
  },
  {
    id: "sakura",
    base: "#dfa7a5",
    shade: "#bf8381",
    foil: ["#f6d9c6", "#b5705c", "#86493a"],
    corner: ["#f6d5c6", "#b67c6a"],
    strap: null,
    ribbon: "#f4e6dc",
    paper: "#fbf2e8",
    grain: 0.22,
    material: "leather",
  },
] as const satisfies readonly CoverTheme[];

export type CoverThemeId = (typeof COVER_THEMES)[number]["id"];

export const DEFAULT_COVER_THEME: CoverThemeId = "forest";

export const COVER_DECORATIONS = [
  { id: "leaf", category: "nature" },
  { id: "mountain", category: "nature" },
  { id: "cat", category: "animals" },
  { id: "coffee", category: "lifestyle" },
  { id: "camera", category: "lifestyle" },
] as const;

export type CoverDecorationId = (typeof COVER_DECORATIONS)[number]["id"];
export type CoverDecorationCategory = (typeof COVER_DECORATIONS)[number]["category"];

/** v1 keeps the cover elegant: one sticker at most (the DB allows up to 3 for later). */
export const MAX_COVER_DECORATIONS = 1;
export const MAX_COVER_NAME_LENGTH = 24;

const themeIds = COVER_THEMES.map((t) => t.id) as [CoverThemeId, ...CoverThemeId[]];
const decorationIds = COVER_DECORATIONS.map((d) => d.id) as [CoverDecorationId, ...CoverDecorationId[]];

export interface CoverPreferences {
  theme: CoverThemeId;
  decorations: CoverDecorationId[];
  /** Short personal name shown on the cover label; null = no label. */
  name: string | null;
  openingAnimationEnabled: boolean;
}

export const DEFAULT_COVER_PREFERENCES: CoverPreferences = {
  theme: DEFAULT_COVER_THEME,
  decorations: [],
  name: null,
  openingAnimationEnabled: true,
};

/** What the server action accepts from the client. Never trusted beyond this. */
export const coverPreferencesSchema = z.object({
  theme: z.enum(themeIds),
  decorations: z.array(z.enum(decorationIds)).max(MAX_COVER_DECORATIONS),
  name: z
    .string()
    .trim()
    .max(MAX_COVER_NAME_LENGTH)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable(),
  openingAnimationEnabled: z.boolean(),
});

export function isCoverThemeId(value: unknown): value is CoverThemeId {
  return typeof value === "string" && themeIds.includes(value as CoverThemeId);
}

export function getCoverTheme(id: string | null | undefined): CoverTheme {
  return COVER_THEMES.find((t) => t.id === id) ?? COVER_THEMES[0];
}

/** Stored profile columns (any may be absent before migration 0040). */
export interface StoredCoverColumns {
  cover_theme?: string | null;
  cover_decorations?: string[] | null;
  cover_name?: string | null;
  opening_animation_enabled?: boolean | null;
}

/**
 * Turns whatever is stored (or nothing, on an unmigrated database) into
 * safe preferences: unknown theme → default, unknown/extra stickers dropped,
 * over-long name trimmed. Never throws.
 */
export function resolveCoverPreferences(row: StoredCoverColumns | null | undefined): CoverPreferences {
  if (!row) return DEFAULT_COVER_PREFERENCES;
  const decorations = (row.cover_decorations ?? [])
    .filter((d): d is CoverDecorationId => decorationIds.includes(d as CoverDecorationId))
    .slice(0, MAX_COVER_DECORATIONS);
  const name = row.cover_name?.trim().slice(0, MAX_COVER_NAME_LENGTH) || null;
  return {
    theme: isCoverThemeId(row.cover_theme) ? row.cover_theme : DEFAULT_COVER_THEME,
    decorations,
    name,
    openingAnimationEnabled: row.opening_animation_enabled ?? true,
  };
}
