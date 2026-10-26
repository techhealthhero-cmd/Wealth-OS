import "server-only";

import { getCategories } from "@/features/categories/queries";
import { getGoals } from "@/features/goals/queries";
import { throwDbError } from "@/lib/db-error";
import { calculateGoalProgress } from "@/lib/financial/goals";
import { parseMoneyToCents } from "@/lib/financial/money";
import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/config";
import { fetchAllPages } from "./lib/paged-fetch";
import {
  aggregateHomeYear,
  goalsInYear,
  homeYearOptions,
  parseHomeYear,
  throughMonthLabel,
  type HomeYearTransaction,
} from "./lib/home-year";

export async function loadHomeYear(input: {
  today: string;
  yearParam?: string;
  locale: Locale;
  uncategorized: string;
  other: string;
}) {
  const selectedYear = parseHomeYear(input.yearParam, input.today);
  const from = `${selectedYear - 1}-01-01`;
  const to = `${selectedYear}-12-31`;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [rows, categories, goals] = await Promise.all([
    fetchAllPages<HomeYearTransaction>(async (start, end) => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, type, amount, category_id, transaction_date")
        .eq("user_id", user.id)
        .in("type", ["income", "expense", "refund"])
        .gte("transaction_date", from)
        .lte("transaction_date", to)
        .order("transaction_date", { ascending: true })
        .order("id", { ascending: true })
        .range(start, end);
      if (error) throwDbError(error, "dashboard.loadHomeYear", "Failed to load yearly transactions");
      return (data ?? []) as HomeYearTransaction[];
    }),
    getCategories(),
    getGoals(),
  ]);

  const summary = aggregateHomeYear(rows, categories, selectedYear, {
    locale: input.locale,
    uncategorized: input.uncategorized,
    other: input.other,
  });
  const intl = input.locale === "th" ? "th-TH" : "en-US";
  const yearGoals = goalsInYear(goals, selectedYear).map((goal) => {
    const currentCents = parseMoneyToCents(goal.current_amount);
    const targetCents = parseMoneyToCents(goal.target_amount);
    const day = goal.target_date?.slice(0, 10);
    return {
      id: goal.id,
      name: goal.name,
      status: goal.status,
      progress: calculateGoalProgress(currentCents, targetCents),
      currentCents,
      targetCents,
      targetLabel: day
        ? new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", timeZone: "UTC" }).format(
            new Date(`${day}T00:00:00Z`),
          )
        : null,
    };
  });

  return {
    selectedYear,
    options: homeYearOptions(input.today),
    throughMonth: throughMonthLabel(input.today, selectedYear, input.locale),
    ...summary,
    goals: yearGoals,
  };
}
