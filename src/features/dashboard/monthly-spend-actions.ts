"use server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { getCategories } from "@/features/categories/queries";
import { getPrivacyGate } from "@/features/account-privacy/gate";
import { todayInTimeZone } from "@/lib/date";
import { fetchAllPages } from "./lib/paged-fetch";
import { aggregateMonthlySpend, spendMonthRange, type MonthlySpendRow } from "./lib/monthly-spend";

export async function getMonthlySpendSummary(month?: string) {
  if (await getPrivacyGate(["overview", "activity"])) return null;
  const profile = await getProfile();
  const currentMonth = todayInTimeZone(profile?.timezone ?? "Asia/Bangkok").slice(0, 7);
  const selectedMonth = month ?? currentMonth;
  const { from, to } = spendMonthRange(selectedMonth);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [rows, categories] = await Promise.all([
    fetchAllPages<MonthlySpendRow>(async (start, end) => {
      const { data, error } = await supabase.from("transactions")
        .select("id, type, amount, category_id, transaction_date, merchant, description")
        .eq("user_id", user.id).gte("transaction_date", from).lte("transaction_date", to)
        .order("id").range(start, end);
      if (error) throw new Error("ไม่สามารถโหลดสรุปรายเดือนได้");
      return data ?? [];
    }), getCategories(),
  ]);
  return aggregateMonthlySpend(rows, categories, selectedMonth, currentMonth);
}
