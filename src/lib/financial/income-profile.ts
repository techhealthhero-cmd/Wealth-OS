/**
 * Income Profile — deterministic analysis of a user's income situation.
 * Real received income always comes from `transactions` (Day 1's source of
 * truth); `income_sources` rows are planning/expected figures only, used
 * here for the stable-vs-variable split and concentration risk, never as a
 * competing "actual" number.
 */

export interface IncomeProfileSource {
  expectedMonthlyIncomeCents: number;
  stability: "stable" | "variable";
  isActive: boolean;
  name: string;
}

export interface IncomeProfileInputs {
  /** Real income transactions for the current (in-progress) month. */
  currentMonthIncomeCents: number;
  /** Real income transactions for each of the trailing months available (most recent first), excluding the current month — used for the average and growth. */
  trailingMonthsIncomeCents: number[];
  sources: IncomeProfileSource[];
}

export type IncomeStabilityRating = "stable" | "mixed" | "variable" | "unknown";

export interface IncomeProfile {
  currentMonthlyIncomeCents: number;
  averageMonthlyIncomeCents: number;
  stableIncomeCents: number;
  variableIncomeCents: number;
  activeSourceCount: number;
  primarySource: string | null;
  /** 0-100. Share of expected income concentrated in the single largest active source. Null when there are no active sources with an expected amount. */
  concentrationPercent: number | null;
  /** Percent change vs. the trailing average. Null when there's no trailing history to compare against. */
  momGrowthPercent: number | null;
  stability: IncomeStabilityRating;
  hasIncomeHistory: boolean;
}

const CONCENTRATION_RISK_THRESHOLD_PERCENT = 90;

export function calculateIncomeProfile(inputs: IncomeProfileInputs): IncomeProfile {
  const activeSources = inputs.sources.filter((s) => s.isActive);
  const stableIncomeCents = activeSources
    .filter((s) => s.stability === "stable")
    .reduce((total, s) => total + s.expectedMonthlyIncomeCents, 0);
  const variableIncomeCents = activeSources
    .filter((s) => s.stability === "variable")
    .reduce((total, s) => total + s.expectedMonthlyIncomeCents, 0);

  const totalExpectedCents = stableIncomeCents + variableIncomeCents;
  const primary = activeSources.reduce<IncomeProfileSource | null>((best, s) => {
    if (!best || s.expectedMonthlyIncomeCents > best.expectedMonthlyIncomeCents) return s;
    return best;
  }, null);

  const concentrationPercent =
    totalExpectedCents > 0 && primary ? (primary.expectedMonthlyIncomeCents / totalExpectedCents) * 100 : null;

  const hasTrailingHistory = inputs.trailingMonthsIncomeCents.length > 0;
  const averageMonthlyIncomeCents = hasTrailingHistory
    ? Math.round(
        inputs.trailingMonthsIncomeCents.reduce((total, cents) => total + cents, 0) /
          inputs.trailingMonthsIncomeCents.length
      )
    : inputs.currentMonthIncomeCents;

  const trailingAverage = hasTrailingHistory
    ? inputs.trailingMonthsIncomeCents.reduce((total, cents) => total + cents, 0) / inputs.trailingMonthsIncomeCents.length
    : null;
  const momGrowthPercent =
    trailingAverage !== null && trailingAverage > 0
      ? ((inputs.currentMonthIncomeCents - trailingAverage) / trailingAverage) * 100
      : null;

  let stability: IncomeStabilityRating;
  if (activeSources.length === 0) {
    stability = "unknown";
  } else if (variableIncomeCents === 0) {
    stability = "stable";
  } else if (stableIncomeCents === 0) {
    stability = "variable";
  } else {
    stability = "mixed";
  }

  return {
    currentMonthlyIncomeCents: inputs.currentMonthIncomeCents,
    averageMonthlyIncomeCents,
    stableIncomeCents,
    variableIncomeCents,
    activeSourceCount: activeSources.length,
    primarySource: primary?.name ?? null,
    concentrationPercent,
    momGrowthPercent,
    stability,
    hasIncomeHistory: hasTrailingHistory || inputs.currentMonthIncomeCents > 0,
  };
}

/** True once a single source represents an outsized share of expected income — see CLAUDE.md's "90% concentration risk" example. */
export function hasIncomeConcentrationRisk(profile: IncomeProfile): boolean {
  return profile.concentrationPercent !== null && profile.concentrationPercent >= CONCENTRATION_RISK_THRESHOLD_PERCENT;
}
