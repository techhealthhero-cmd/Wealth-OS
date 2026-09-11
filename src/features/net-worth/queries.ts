import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getAccounts } from "@/features/accounts/queries";
import { getAssets } from "@/features/assets/queries";
import { getLiabilities } from "@/features/liabilities/queries";
import { calculateNetWorth, type NetWorthResult } from "@/lib/financial/net-worth";
import { parseMoneyToCents, centsToDecimalString } from "@/lib/financial/money";
import type { Asset, Liability, NetWorthSnapshot } from "@/types/database";

export interface NetWorthBreakdown extends NetWorthResult {
  assets: Asset[];
  liabilities: Liability[];
}

export async function getNetWorthBreakdown(): Promise<NetWorthBreakdown> {
  const [accounts, assets, liabilities] = await Promise.all([
    getAccounts(),
    getAssets(),
    getLiabilities(),
  ]);

  const result = calculateNetWorth(
    accounts.map((a) => ({
      balanceCents: parseMoneyToCents(a.current_balance),
      includeInNetWorth: a.include_in_net_worth,
    })),
    assets.map((a) => ({
      valueCents: parseMoneyToCents(a.value),
      includeInNetWorth: a.include_in_net_worth,
      linkedAccountId: a.linked_account_id,
    })),
    liabilities.map((l) => ({
      balanceCents: parseMoneyToCents(l.balance),
      includeInNetWorth: l.include_in_net_worth,
    }))
  );

  return { ...result, assets, liabilities };
}

export async function getNetWorthSnapshots(limit = 12): Promise<NetWorthSnapshot[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("net_worth_snapshots")
    .select("*")
    .order("snapshot_date", { ascending: false })
    .limit(limit);

  if (error) throw new Error("Failed to load net worth history");
  return (data ?? []).reverse();
}

/**
 * Upserts today's snapshot from the current live breakdown. Called whenever
 * the Net Worth page is viewed — idempotent (unique(user_id, snapshot_date)),
 * so repeated visits the same day just update today's row instead of
 * accumulating duplicates. This is how "periodic snapshots" are populated
 * for Day 2, without needing a separate cron job.
 */
export async function recordTodaysNetWorthSnapshot(breakdown: NetWorthResult): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const today = new Date().toISOString().slice(0, 10);
  await supabase.from("net_worth_snapshots").upsert(
    {
      user_id: user.id,
      snapshot_date: today,
      total_assets: centsToDecimalString(breakdown.totalAssetsCents),
      total_liabilities: centsToDecimalString(breakdown.totalLiabilitiesCents),
      net_worth: centsToDecimalString(breakdown.netWorthCents),
    },
    { onConflict: "user_id,snapshot_date" }
  );
}
