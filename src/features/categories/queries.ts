import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Category, CategoryType } from "@/types/database";

export async function getCategories(type?: CategoryType): Promise<Category[]> {
  const supabase = await createClient();
  let query = supabase.from("categories").select("*").order("sort_order", { ascending: true });

  if (type) {
    query = query.or(`type.eq.${type},type.eq.both`);
  }

  const { data, error } = await query;
  if (error) throw new Error("Failed to load categories");
  return data ?? [];
}
