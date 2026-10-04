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

export interface CompanionDefinition {
  id: string;
  kind: CompanionKind;
  /** Public path of the round avatar (see public/companions/README.md). */
  image: string;
  focus: CompanionFocus;
  access: CompanionAccess;
  /** Short emoji used as the speech-bubble signature. */
  emoji: string;
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
  },
  {
    id: "spirit-flame",
    kind: "spirit",
    image: "/companions/spirits/flame.png",
    focus: "spending",
    access: { type: "progress", rule: "budget_month_kept" },
    emoji: "🔥",
  },
  {
    id: "spirit-leaf",
    kind: "spirit",
    image: "/companions/spirits/leaf.png",
    focus: "saving",
    access: { type: "progress", rule: "emergency_fund_one_month" },
    emoji: "🍃",
  },
  {
    id: "spirit-hooded",
    kind: "spirit",
    image: "/companions/spirits/hooded.png",
    focus: "debt",
    access: { type: "progress", rule: "money_leaks_handled" },
    emoji: "🖤",
  },
  {
    id: "wizard-hat",
    kind: "wizard",
    image: "/companions/wizards/hat.png",
    focus: "planning",
    access: { type: "plan", feature: FEATURES.COMPANION_WIZARDS },
    emoji: "🎩",
  },
  {
    id: "wizard-caped",
    kind: "wizard",
    image: "/companions/wizards/caped.png",
    focus: "income",
    access: { type: "plan", feature: FEATURES.COMPANION_WIZARDS },
    emoji: "📖",
  },
  {
    id: "wizard-hooded",
    kind: "wizard",
    image: "/companions/wizards/hooded.png",
    focus: "insights",
    access: { type: "plan", feature: FEATURES.COMPANION_PRO_WIZARD },
    emoji: "🔮",
  },
];

export function getCompanion(id: string | null | undefined): CompanionDefinition | null {
  if (!id) return null;
  return COMPANIONS.find((c) => c.id === id) ?? null;
}

export function getStarterCompanion(): CompanionDefinition {
  return getCompanion(STARTER_COMPANION_ID)!;
}
