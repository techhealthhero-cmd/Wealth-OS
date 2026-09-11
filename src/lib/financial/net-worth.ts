/**
 * Net Worth = Total Included Assets − Total Included Liabilities.
 *
 * Double-counting rule (see supabase/migrations/0003_wealth_engine.sql header
 * and CLAUDE.md "NET WORTH"): an `accounts` row already contributes its
 * balance when `includeInNetWorth` is true. A manual `assets` row is for
 * wealth NOT already represented by an account — if it has a
 * `linkedAccountId`, the linked account is the one counted, and the asset
 * row itself is excluded here to avoid counting the same money twice.
 */

export interface NetWorthAccountInput {
  balanceCents: number;
  includeInNetWorth: boolean;
}

export interface NetWorthAssetInput {
  valueCents: number;
  includeInNetWorth: boolean;
  linkedAccountId: string | null;
}

export interface NetWorthLiabilityInput {
  balanceCents: number;
  includeInNetWorth: boolean;
}

export interface NetWorthResult {
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
  netWorthCents: number;
  /** Included-accounts total and included-manual-assets total, broken out for display. */
  accountAssetsCents: number;
  manualAssetsCents: number;
}

export function calculateNetWorth(
  accounts: NetWorthAccountInput[],
  assets: NetWorthAssetInput[],
  liabilities: NetWorthLiabilityInput[]
): NetWorthResult {
  const accountAssetsCents = accounts
    .filter((a) => a.includeInNetWorth)
    .reduce((sum, a) => sum + a.balanceCents, 0);

  const manualAssetsCents = assets
    .filter((a) => a.includeInNetWorth && a.linkedAccountId === null)
    .reduce((sum, a) => sum + a.valueCents, 0);

  const totalAssetsCents = accountAssetsCents + manualAssetsCents;

  const totalLiabilitiesCents = liabilities
    .filter((l) => l.includeInNetWorth)
    .reduce((sum, l) => sum + l.balanceCents, 0);

  return {
    totalAssetsCents,
    totalLiabilitiesCents,
    netWorthCents: totalAssetsCents - totalLiabilitiesCents,
    accountAssetsCents,
    manualAssetsCents,
  };
}

export interface NetWorthChange {
  changeCents: number;
  /** Percent change vs the previous value; null when the previous value was 0 (undefined percentage). */
  changePercent: number | null;
}

export function calculateNetWorthChange(currentCents: number, previousCents: number): NetWorthChange {
  const changeCents = currentCents - previousCents;
  if (previousCents === 0) {
    return { changeCents, changePercent: null };
  }
  return { changeCents, changePercent: (changeCents / Math.abs(previousCents)) * 100 };
}
