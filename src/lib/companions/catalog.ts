/**
 * AI companions (ภูติ / จอมเวท) — the single source of truth for which
 * companions exist, what each one focuses on, and how it becomes available.
 * Pure config, same role as src/lib/billing/plans.ts: no DB, no auth,
 * importable from client and server alike.
 *
 * Two families, two ways to get one (decided 2026-10-04):
 * - Spirits are EARNED through real financial progress and can never be
 *   bought, on any plan — "unlocked because you saved well" must keep its
 *   meaning, and selling them would turn this into a gacha shop
 *   (PRODUCT_OUTCOMES.md: no casino-style loops).
 * - Wizards come with Plus/Pro, each one specializing in features that plan
 *   already includes — so a paying user gets a character that uses what
 *   they pay for, never "better advice" than a free user's spirit.
 *
 * Every companion reads the same deterministic financial data; `focus` only
 * changes which topic it raises first and its tone, never the numbers.
 */
import { FEATURES, type FeatureId } from "@/lib/billing/plans";

export type CompanionKind = "spirit" | "wizard";

export type CompanionFocus = "overview" | "spending" | "saving" | "debt" | "planning" | "income" | "insights";

/** Deterministic progress milestones — evaluated by src/lib/companions/unlock.ts. */
export type UnlockRuleId = "budget_month_kept" | "emergency_fund_one_month" | "money_leaks_handled";

export type CompanionAccess =
  | { type: "starter" }
  | { type: "progress"; rule: UnlockRuleId }
  | { type: "plan"; feature: FeatureId };

/**
 * The companion's own look for the AI panel (2026-10-04): every value is a
 * CSS color. `primary` re-themes the panel's interactive accents (active
 * tab, send button, focus ring) and must stay mid-lightness so white text
 * on it reads well in both light and dark mode; `headerFrom/To` paint the
 * header; `glow` is the avatar halo and header shimmer, taken from the art.
 */
export interface CompanionTheme {
  primary: string;
  headerFrom: string;
  headerTo: string;
  glow: string;
}

export interface CompanionDefinition {
  id: string;
  kind: CompanionKind;
  /** Public path of the round avatar (see public/companions/README.md). */
  image: string;
  focus: CompanionFocus;
  access: CompanionAccess;
  /** Short emoji used as the speech-bubble signature and header watermark. */
  emoji: string;
  theme: CompanionTheme;
}

export const STARTER_COMPANION_ID = "spirit-mint";

export const COMPANIONS: readonly CompanionDefinition[] = [
  {
    id: "spirit-mint",
    kind: "spirit",
    image: "/companions/spirits/mint.png",
    focus: "overview",
    access: { type: "starter" },
    emoji: "🌱",
    // Soft mint glow on calm teal — gentle, all-round.
    theme: { primary: "oklch(0.52 0.09 168)", headerFrom: "oklch(0.50 0.08 170)", headerTo: "oklch(0.30 0.05 172)", glow: "oklch(0.88 0.08 165)" },
  },
  {
    id: "spirit-flame",
    kind: "spirit",
    image: "/companions/spirits/flame.png",
    focus: "spending",
    access: { type: "progress", rule: "budget_month_kept" },
    emoji: "🔥",
    // Jade spirit-fire on deep green — energetic, alert.
    theme: { primary: "oklch(0.52 0.12 158)", headerFrom: "oklch(0.46 0.11 160)", headerTo: "oklch(0.24 0.05 165)", glow: "oklch(0.85 0.15 158)" },
  },
  {
    id: "spirit-leaf",
    kind: "spirit",
    image: "/companions/spirits/leaf.png",
    focus: "saving",
    access: { type: "progress", rule: "emergency_fund_one_month" },
    emoji: "🍃",
    // Light sage, like the leaf spirit's art — warm, patient.
    theme: { primary: "oklch(0.52 0.07 140)", headerFrom: "oklch(0.62 0.06 140)", headerTo: "oklch(0.38 0.05 145)", glow: "oklch(0.90 0.07 130)" },
  },
  {
    id: "spirit-hooded",
    kind: "spirit",
    image: "/companions/spirits/hooded.png",
    focus: "debt",
    access: { type: "progress", rule: "money_leaks_handled" },
    emoji: "🖤",
    // Near-black shadow with glowing mint eyes — quiet hunter.
    theme: { primary: "oklch(0.45 0.05 165)", headerFrom: "oklch(0.34 0.025 165)", headerTo: "oklch(0.17 0.015 165)", glow: "oklch(0.88 0.12 165)" },
  },
  {
    id: "wizard-hat",
    kind: "wizard",
    image: "/companions/wizards/hat.png",
    focus: "planning",
    access: { type: "plan", feature: FEATURES.COMPANION_WIZARDS },
    emoji: "🎩",
    // Forest green with the hat's gold star — the planner.
    theme: { primary: "oklch(0.48 0.07 160)", headerFrom: "oklch(0.42 0.06 162)", headerTo: "oklch(0.24 0.04 165)", glow: "oklch(0.85 0.12 85)" },
  },
  {
    id: "wizard-caped",
    kind: "wizard",
    image: "/companions/wizards/caped.png",
    focus: "income",
    access: { type: "plan", feature: FEATURES.COMPANION_WIZARDS },
    emoji: "📖",
    // Black cape with vivid emerald magic — ambitious.
    theme: { primary: "oklch(0.47 0.11 155)", headerFrom: "oklch(0.28 0.04 155)", headerTo: "oklch(0.14 0.02 155)", glow: "oklch(0.78 0.18 152)" },
  },
  {
    id: "wizard-hooded",
    kind: "wizard",
    image: "/companions/wizards/hooded.png",
    focus: "insights",
    access: { type: "plan", feature: FEATURES.COMPANION_PRO_WIZARD },
    emoji: "🔮",
    // Dark emerald hood with a green arcane glow — the analyst.
    theme: { primary: "oklch(0.47 0.08 162)", headerFrom: "oklch(0.36 0.05 160)", headerTo: "oklch(0.16 0.02 160)", glow: "oklch(0.80 0.15 155)" },
  },
];

/**
 * The 3 one-tap questions the AI window offers, by companion focus
 * (2026-10-04 simplification: replaces the 6 quick-action cards + the
 * shuffled example list, which did the same job twice). Keys index
 * `aiCoach.suggestedPrompts` — existing, already-translated prompts.
 */
export const COMPANION_SUGGESTION_KEYS: Record<CompanionFocus, readonly [string, string, string]> = {
  overview: ["monthSummary", "topFocus", "financialProgressQuestion"],
  spending: ["overspending", "upcomingBillsQuestion", "safeToSpendExplain"],
  saving: ["reachGoalFaster", "financialProgressQuestion", "monthSummary"],
  debt: ["debtAdvice", "unusedSubscriptionQuestion", "upcomingBillsQuestion"],
  planning: ["reachGoalFaster", "whatMissionToday", "wealthScoreExplain"],
  income: ["reachExtraIncome", "fastestSkill", "sideHustleForMyTime"],
  insights: ["wealthScoreExplain", "overspending", "financialProgressQuestion"],
};

export function getCompanion(id: string | null | undefined): CompanionDefinition | null {
  if (!id) return null;
  return COMPANIONS.find((c) => c.id === id) ?? null;
}

export function getStarterCompanion(): CompanionDefinition {
  return getCompanion(STARTER_COMPANION_ID)!;
}
