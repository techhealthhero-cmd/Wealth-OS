import { calculateExpenses, calculateIncome, calculateMonthlyCashFlow, calculateSpendingByCategory, type FinancialTransaction } from "@/lib/financial/calculations";
import { parseMoneyToCents } from "@/lib/financial/money";
import { calendarMonth } from "@/lib/date";
import { monthLabel, slipCategoryIcon } from "@/features/capture/components/slip-auto/format";
import type { MonthlySpendSummary } from "@/features/capture/components/slip-auto/types";

export interface MonthlySpendRow extends FinancialTransaction { id: string; transaction_date: string; merchant: string | null; description: string | null }
export function spendMonthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month < "1900-01" || month > "9998-12") throw new Error("Invalid month");
  return calendarMonth(`${month}-01`);
}
export function shiftSpendMonth(month: string, delta: number): string {
  spendMonthRange(month);
  const date = new Date(`${month}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}
export function monthlyCategoryHref(month: string, categoryId: string): string {
  const { from, to } = spendMonthRange(month);
  const params = new URLSearchParams({ month, from, to, type: "expense" });
  if (categoryId !== "uncategorized") params.set("categoryId", categoryId);
  return `/money/transactions?${params}`;
}
export function aggregateMonthlySpend(rows: MonthlySpendRow[], categories: { id: string; name_th: string; name_en: string }[], month: string, currentMonth: string): MonthlySpendSummary {
  const { from, to } = spendMonthRange(month);
  const selected = rows.filter(t => t.transaction_date >= from && t.transaction_date <= to);
  const spentCents = calculateExpenses(selected);
  const groups = calculateSpendingByCategory(selected);
  const gross = groups.reduce((sum, c) => sum + c.totalCents, 0);
  return { monthLabel: monthLabel(from), monthShortLabel: new Intl.DateTimeFormat("th-TH", { month: "long", timeZone: "UTC" }).format(new Date(`${from}T00:00:00Z`)), spentCents, incomeCents: calculateIncome(selected), leftCents: calculateMonthlyCashFlow(selected),
    categories: groups.map(group => {
      const category = categories.find(c => c.id === group.categoryId);
      return { id: group.categoryId ?? "uncategorized", label: category?.name_th ?? "ยังไม่จัดหมวด", icon: slipCategoryIcon(category?.name_en ?? ""), amountCents: group.totalCents, percent: gross > 0 ? Math.round(group.totalCents / gross * 100) : 0,
        items: selected.filter(t => t.type === "expense" && (t.category_id ?? null) === group.categoryId).map(t => ({ id: t.id, title: t.description || t.merchant || category?.name_th || "รายจ่าย", dateLabel: t.transaction_date, amountCents: parseMoneyToCents(t.amount) })) };
    }), insight: null, canGoPrev: month > "1900-01", canGoNext: month < currentMonth };
}
