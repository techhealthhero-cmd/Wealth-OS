import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { IncomeMission } from "@/types/database";
import { throwDbError } from "@/lib/db-error";

export async function getIncomeMissions(): Promise<IncomeMission[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("income_missions")
    .select("*")
    .order("sequence_order", { ascending: true });
  if (error) throwDbError(error, "income-missions.getIncomeMissions", "Failed to load income missions");
  return data ?? [];
}

/** The single next actionable mission — the first not completed/skipped, in sequence order. Used for "Today's Income Mission." */
export async function getTodayMission(): Promise<IncomeMission | null> {
  const missions = await getIncomeMissions();
  return missions.find((m) => m.status === "not_started" || m.status === "in_progress") ?? null;
}

export async function getActiveIncomeMissions(): Promise<IncomeMission[]> {
  const missions = await getIncomeMissions();
  return missions.filter((m) => m.status === "not_started" || m.status === "in_progress");
}
