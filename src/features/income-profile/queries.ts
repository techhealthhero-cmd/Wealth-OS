import "server-only";

import { getTransactions, getCurrentMonthRange } from "@/features/transactions/queries";
import { getIncomeSources } from "@/features/income-sources/queries";
import { calculateIncome } from "@/lib/financial/calculations";
import { parseMoneyToCents } from "@/lib/financial/money";
import { calculateIncomeProfile, type IncomeProfile } from "@/lib/financial/income-profile";
import { toLocalDateString } from "@/lib/date";
import type { IncomeSource } from "@/types/database";

const TRAILING_MONTHS = 3;

function trailingMonthsRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - TRAILING_MONTHS, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0); // last day of the month before the current one
  return { from: toLocalDateString(from), to: toLocalDateString(to) };
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

export interface IncomeProfileSummary {
  profile: IncomeProfile;
  sources: IncomeSource[];
}

export async function getIncomeProfileSummary(): Promise<IncomeProfileSummary> {
  const { from: currentFrom, to: currentTo } = getCurrentMonthRange();
  const { from: trailingFrom, to: trailingTo } = trailingMonthsRange();

  const [currentMonthTx, trailingTx, sources] = await Promise.all([
    getTransactions({ from: currentFrom, to: currentTo, type: "income" }),
    getTransactions({ from: trailingFrom, to: trailingTo, type: "income" }),
    getIncomeSources(),
  ]);

  const byMonth = new Map<string, typeof trailingTx>();
  for (const t of trailingTx) {
    const key = monthKey(t.transaction_date);
    const bucket = byMonth.get(key) ?? [];
    bucket.push(t);
    byMonth.set(key, bucket);
  }
  const trailingMonthsIncomeCents = Array.from(byMonth.values()).map((tx) => calculateIncome(tx));

  const profile = calculateIncomeProfile({
    currentMonthIncomeCents: calculateIncome(currentMonthTx),
    trailingMonthsIncomeCents,
    sources: sources.map((s) => ({
      name: s.name,
      expectedMonthlyIncomeCents: parseMoneyToCents(s.expected_monthly_income),
      stability: s.stability,
      isActive: s.is_active,
    })),
  });

  return { profile, sources };
}
