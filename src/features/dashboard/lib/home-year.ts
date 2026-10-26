/**
 * Home year overview — DISPLAY-ONLY aggregation.
 *
 * Selected calendar year vs the previous full calendar year (1 Jan–31 Dec),
 * not year-to-date vs the same months last year. The current year simply
 * has no future transactions, so its totals run through today; the chip
 * "ถึง ต.ค." says so. ออมได้ is income − expenses for the selected year,
 * via the existing calculateMonthlyCashFlow() (expenses already net of
 * refunds). Category rows use the same netting so the column can add up
 * to that expense total. Nothing here is stored or fed into another formula.
 */
import type { Locale } from "@/i18n/config";
import {
  calculateExpenses,
  calculateIncome,
  calculateMonthlyCashFlow,
  type FinancialTransaction,
} from "@/lib/financial/calculations";
import { parseMoneyToCents } from "@/lib/financial/money";

export const BUDDHIST_ERA_OFFSET = 543;
/** Named categories before the rest folds into "อื่นๆ". */
export const HOME_YEAR_NAMED_CAP = 7;
/** Show every category when the table would still be this short. */
export const HOME_YEAR_TABLE_CAP = 8;
/** Ignore category moves smaller than ฿500 — not worth a sentence. */
export const HOME_YEAR_INSIGHT_MIN_CENTS = 50_000;

const TH_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."] as const;

export interface HomeYearTransaction extends FinancialTransaction {
  /** "YYYY-MM-DD" */
  transaction_date: string;
}

export interface HomeYearCategoryInput {
  id: string;
  name_th: string;
  name_en: string;
}

export interface YearCategoryComparison {
  id: string;
  label: string;
  currentCents: number;
  previousCents: number;
  isOther: boolean;
}

export interface HomeYearInsight {
  categoryId: string;
  label: string;
  direction: "up" | "down";
  currentCents: number;
  previousCents: number;
}

export interface HomeYearAggregate {
  incomeCents: number;
  expenseCents: number;
  /** Income − expenses for the selected year. */
  savedCents: number;
  categories: YearCategoryComparison[];
  insight: HomeYearInsight | null;
}

export interface HomeYearOption {
  gregorian: number;
  buddhist: number;
  /** Current year stays on /dashboard; earlier years use ?year=2568. */
  href: string;
}

export interface HomeYearGoalInput {
  target_date: string | null;
}

function gregorianYearOf(today: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error("Invalid date");
  return Number(today.slice(0, 4));
}

export function buddhistYear(gregorianYear: number): number {
  return gregorianYear + BUDDHIST_ERA_OFFSET;
}

/** Current year, then the two before it — the three pills on Home. */
export function homeYearOptions(today: string): HomeYearOption[] {
  const current = gregorianYearOf(today);
  return [0, -1, -2].map((delta) => {
    const gregorian = current + delta;
    const buddhist = buddhistYear(gregorian);
    return {
      gregorian,
      buddhist,
      href: delta === 0 ? "/dashboard" : `/dashboard?year=${buddhist}`,
    };
  });
}

/**
 * Accepts a Buddhist year query (2569) only when it is one of the three
 * pills. Anything else, including a Gregorian year, falls back to today.
 */
export function parseHomeYear(param: string | undefined, today: string): number {
  const current = gregorianYearOf(today);
  if (!param || !/^\d{4}$/.test(param)) return current;
  const gregorian = Number(param) - BUDDHIST_ERA_OFFSET;
  if (gregorian === current || gregorian === current - 1 || gregorian === current - 2) return gregorian;
  return current;
}

/** Short month for the current-year chip. Null for any other selected year. */
export function throughMonthLabel(today: string, selectedYear: number, locale: Locale): string | null {
  const year = gregorianYearOf(today);
  if (selectedYear !== year) return null;
  const month = Number(today.slice(5, 7));
  if (month < 1 || month > 12) return null;
  if (locale === "th") return TH_MONTHS_SHORT[month - 1];
  return new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

export function longMonthName(isoDate: string, locale: Locale): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) throw new Error("Invalid date");
  const [year, month] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function goalsInYear<T extends HomeYearGoalInput>(goals: readonly T[], gregorianYear: number): T[] {
  const from = `${gregorianYear}-01-01`;
  const to = `${gregorianYear}-12-31`;
  return goals.filter((goal) => {
    if (!goal.target_date) return false;
    const day = goal.target_date.slice(0, 10);
    return day >= from && day <= to;
  });
}

function inYear(rows: readonly HomeYearTransaction[], year: number): HomeYearTransaction[] {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  return rows.filter((row) => row.transaction_date >= from && row.transaction_date <= to);
}

/** Expense totals net of refunds in the same category. Transfers are ignored. */
function netExpenseByCategory(rows: readonly HomeYearTransaction[]): Map<string | null, number> {
  const totals = new Map<string | null, number>();
  for (const row of rows) {
    if (row.type !== "expense" && row.type !== "refund") continue;
    const key = row.category_id ?? null;
    const cents = parseMoneyToCents(row.amount);
    totals.set(key, (totals.get(key) ?? 0) + (row.type === "refund" ? -cents : cents));
  }
  return totals;
}

function categoryInsight(rows: readonly YearCategoryComparison[]): HomeYearInsight | null {
  let best: YearCategoryComparison | null = null;
  let bestAbs = 0;
  for (const row of rows) {
    if (row.isOther || row.id === "uncategorized") continue;
    if (row.previousCents <= 0 || row.currentCents < 0) continue;
    const delta = row.currentCents - row.previousCents;
    const abs = Math.abs(delta);
    if (abs < HOME_YEAR_INSIGHT_MIN_CENTS || abs <= bestAbs) continue;
    best = row;
    bestAbs = abs;
  }
  if (!best) return null;
  const delta = best.currentCents - best.previousCents;
  return {
    categoryId: best.id,
    label: best.label,
    direction: delta > 0 ? "up" : "down",
    currentCents: best.currentCents,
    previousCents: best.previousCents,
  };
}

export function aggregateHomeYear(
  rows: readonly HomeYearTransaction[],
  categories: readonly HomeYearCategoryInput[],
  selectedYear: number,
  copy: { locale: Locale; uncategorized: string; other: string },
): HomeYearAggregate {
  const selected = inYear(rows, selectedYear);
  const previous = inYear(rows, selectedYear - 1);
  const incomeCents = calculateIncome(selected);
  const expenseCents = calculateExpenses(selected);
  const savedCents = calculateMonthlyCashFlow(selected);

  const currentByCategory = netExpenseByCategory(selected);
  const previousByCategory = netExpenseByCategory(previous);
  const byId = new Map(categories.map((category) => [category.id, category]));
  const labelFor = (id: string | null) => {
    if (!id) return copy.uncategorized;
    const category = byId.get(id);
    if (!category) return copy.uncategorized;
    return copy.locale === "th" ? category.name_th : category.name_en;
  };

  const ids = new Set<string | null>([...currentByCategory.keys(), ...previousByCategory.keys()]);
  const ranked: YearCategoryComparison[] = [...ids]
    .map((id) => ({
      id: id ?? "uncategorized",
      label: labelFor(id),
      currentCents: currentByCategory.get(id) ?? 0,
      previousCents: previousByCategory.get(id) ?? 0,
      isOther: false,
    }))
    .filter((row) => row.currentCents !== 0 || row.previousCents !== 0)
    .sort(
      (a, b) =>
        b.currentCents - a.currentCents ||
        b.previousCents - a.previousCents ||
        a.label.localeCompare(b.label, copy.locale),
    );

  const categoriesOut: YearCategoryComparison[] =
    ranked.length <= HOME_YEAR_TABLE_CAP
      ? ranked
      : [
          ...ranked.slice(0, HOME_YEAR_NAMED_CAP),
          {
            id: "other",
            label: copy.other,
            currentCents: ranked.slice(HOME_YEAR_NAMED_CAP).reduce((sum, row) => sum + row.currentCents, 0),
            previousCents: ranked.slice(HOME_YEAR_NAMED_CAP).reduce((sum, row) => sum + row.previousCents, 0),
            isOther: true,
          },
        ];

  return {
    incomeCents,
    expenseCents,
    savedCents,
    categories: categoriesOut,
    insight: categoryInsight(categoriesOut),
  };
}
