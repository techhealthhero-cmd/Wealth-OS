import "server-only";
import { cache } from "react";
import { throwDbError } from "@/lib/db-error";

import { createClient } from "@/lib/supabase/server";
import type { Asset } from "@/types/database";

/** Wrapped in React's `cache()` (perf audit finding) — called via `getNetWorthBreakdown()` up to 3x on a single dashboard render. */
export const getAssets = cache(async (): Promise<Asset[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throwDbError(error, "assets.getAssets", "Failed to load assets");
  return data ?? [];
});

export async function getAsset(id: string): Promise<Asset | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("assets").select("*").eq("id", id).maybeSingle();
  if (error) throwDbError(error, "assets.getAsset", "Failed to load asset");
  return data;
}
