import "server-only";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Category, CategoryType } from "@/types/database";

/** Wrapped in React's `cache()` (perf audit finding) — `type` is a primitive, so calls with the same (or no) type argument dedupe correctly across a request. */
export const getCategories = cache(async (type?: CategoryType): Promise<Category[]> => {
  const supabase = await createClient();
  let query = supabase.from("categories").select("*").order("sort_order", { ascending: true });

  if (type) {
    query = query.or(`type.eq.${type},type.eq.both`);
  }

  const { data, error } = await query;
  if (error) throw new Error("Failed to load categories");
  return data ?? [];
});
