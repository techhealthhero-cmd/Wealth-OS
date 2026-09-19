import "server-only";
import { cache } from "react";
import { throwDbError } from "@/lib/db-error";

import { createClient } from "@/lib/supabase/server";
import { getAccounts } from "@/features/accounts/queries";
import { getAssets } from "@/features/assets/queries";
import { getLiabilities } from "@/features/liabilities/queries";
import { calculateNetWorth, type NetWorthResult } from "@/lib/financial/net-worth";
import { parseMoneyToCents, centsToDecimalString } from "@/lib/financial/money";
import { toLocalDateString } from "@/lib/date";
import { withPerfLog } from "@/lib/dev-diagnostics";
import type { Asset, Liability, NetWorthSnapshot } from "@/types/database";

export interface NetWorthBreakdown extends NetWorthResult {
  assets: Asset[];
  liabilities: Liability[];
}

/**
 * Wrapped in React's `cache()` (perf audit finding): called independently
 * (directly, and again inside the Wealth Score computation and the Life
 * Stage priority engine) up to 3x on a single dashboard render.
 */
export const getNetWorthBreakdown = cache((): Promise<NetWorthBreakdown> => withPerfLog("getNetWorthBreakdown", async () => {
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
      linkedAccountId: l.linked_account_id,
    }))
  );

  return { ...result, assets, liabilities };
}));

export async function getNetWorthSnapshots(limit = 12): Promise<NetWorthSnapshot[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("net_worth_snapshots")
    .select("*")
    .order("snapshot_date", { ascending: false })
    .limit(limit);

  if (error) throwDbError(error, "net-worth.getNetWorthSnapshots", "Failed to load net worth history");
  return (data ?? []).reverse();
}

/** Snapshots from the last N calendar months, oldest first — for a trend chart, not a fixed row count. */
export async function getNetWorthSnapshotsSince(monthsBack: number): Promise<NetWorthSnapshot[]> {
  const supabase = await createClient();
  const since = new Date();
  since.setMonth(since.getMonth() - monthsBack);

  const { data, error } = await supabase
    .from("net_worth_snapshots")
    .select("*")
    .gte("snapshot_date", toLocalDateString(since))
    .order("snapshot_date", { ascending: true });

  if (error) throwDbError(error, "net-worth.getNetWorthSnapshotsSince", "Failed to load net worth history");
  return data ?? [];
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

  const today = toLocalDateString(new Date());
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

/**
 * Same upsert as `recordTodaysNetWorthSnapshot`, but skips the write when
 * today's row already exists — mirrors `ensureTodaysWealthScore()`'s
 * once-per-day pattern so a page that's viewed many times a day (the
 * dashboard, unlike the Net Worth page which is visited far less often)
 * doesn't issue a redundant write on every load.
 */
export async function ensureTodaysNetWorthSnapshot(breakdown: NetWorthResult): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const today = toLocalDateString(new Date());
  const { data: latest } = await supabase
    .from("net_worth_snapshots")
    .select("snapshot_date")
    .eq("user_id", user.id)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest?.snapshot_date === today) return;
  await recordTodaysNetWorthSnapshot(breakdown);
}
