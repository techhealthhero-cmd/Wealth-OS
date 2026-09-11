import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Liability } from "@/types/database";

export async function getLiabilities(): Promise<Liability[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("liabilities")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw new Error("Failed to load liabilities");
  return data ?? [];
}

export async function getLiability(id: string): Promise<Liability | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("liabilities").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Failed to load liability");
  return data;
}
