import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Asset } from "@/types/database";

export async function getAssets(): Promise<Asset[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw new Error("Failed to load assets");
  return data ?? [];
}

export async function getAsset(id: string): Promise<Asset | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("assets").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Failed to load asset");
  return data;
}
