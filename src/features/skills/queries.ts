import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { UserSkill } from "@/types/database";
import { throwDbError } from "@/lib/db-error";

export async function getUserSkills(): Promise<UserSkill[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("user_skills").select("*").order("created_at", { ascending: true });
  if (error) throwDbError(error, "skills.getUserSkills", "Failed to load skills");
  return data ?? [];
}

export async function getUserSkill(id: string): Promise<UserSkill | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("user_skills").select("*").eq("id", id).maybeSingle();
  if (error) throwDbError(error, "skills.getUserSkill", "Failed to load skill");
  return data;
}
