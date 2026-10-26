import "server-only";

import { throwDbError } from "@/lib/db-error";
import { createClient } from "@/lib/supabase/server";
import type { NetWorthSnapshot } from "@/types/database";
import { yearChangeLookupWindow } from "./net-worth-baseline";

/**
 * Baseline snapshot for Home's "ปีนี้" line. Prefers a snapshot on or just
 * before 1 Jan. Otherwise the earliest snapshot later in the same year,
 * which the card must label "since {month}" rather than "this year".
 */
export async function getYearChangeBaseline(today: string): Promise<NetWorthSnapshot | null> {
  const window = yearChangeLookupWindow(today);
  const supabase = await createClient();

  const near = await supabase
    .from("net_worth_snapshots")
    .select("*")
    .gte("snapshot_date", window.nearFrom)
    .lte("snapshot_date", window.nearTo)
    .lt("snapshot_date", today)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (near.error) throwDbError(near.error, "dashboard.getYearChangeBaseline", "Failed to load year-start net worth");
  if (near.data) return near.data;

  const inYear = await supabase
    .from("net_worth_snapshots")
    .select("*")
    .gte("snapshot_date", window.inYearFrom)
    .lt("snapshot_date", today)
    .order("snapshot_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (inYear.error) throwDbError(inYear.error, "dashboard.getYearChangeBaseline", "Failed to load in-year net worth");
  return inYear.data;
}
