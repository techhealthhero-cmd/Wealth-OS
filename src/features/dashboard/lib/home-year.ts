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
 *
 * Categories that display as the same label share one row. The system
 * "อื่นๆ" / "Other" category, a second category with that name (income and
 * expense each have one), a null category, and an unknown category id all
 * land in that single อื่นๆ row. When the table is longer than eight rows,
 * the tail folds into that same row instead of appending a second one.
 * Rows stay sorted by this year's spend, high to low.
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

function normalizeLabel(label: string): string {
  return label.trim().toLocaleLowerCase();
}

/** Ignore spaces so "อื่น ๆ" and "อื่นๆ" are the same catch-all. */
function compactLabel(label: string): string {
  return normalizeLabel(label).replace(/\s+/g, "");
}

const CATCH_ALL_LABELS = ["อื่นๆ", "อื่น ๆ", "other", "uncategorized", "ไม่ระบุหมวด"];

function isCatchAllLabel(label: string, copy: { other: string; uncategorized: string }): boolean {
  const compact = compactLabel(label);
  if (!compact) return false;
  return [copy.other, copy.uncategorized, ...CATCH_ALL_LABELS].some((alias) => compactLabel(alias) === compact);
}

function compareCategories(locale: Locale) {
  return (a: YearCategoryComparison, b: YearCategoryComparison) =>
    b.currentCents - a.currentCents ||
    b.previousCents - a.previousCents ||
    a.label.localeCompare(b.label, locale);
}

/**
 * Keep at most eight rows. The tail folds into the existing อื่นๆ row when
 * there is one, so a real "อื่นๆ" category and the overflow never both show.
 * The merged row is sorted back into place by this year's amount.
 */
function foldHomeYearCategories(
  ranked: readonly YearCategoryComparison[],
  otherLabel: string,
  locale: Locale,
): YearCategoryComparison[] {
  if (ranked.length <= HOME_YEAR_TABLE_CAP) return [...ranked];

  const existingOther = ranked.find((row) => row.isOther);
  const named = ranked.filter((row) => !row.isOther);
  const head = named.slice(0, HOME_YEAR_NAMED_CAP);
  const tail = named.slice(HOME_YEAR_NAMED_CAP);
  const folded: YearCategoryComparison = {
    id: "other",
    label: otherLabel,
    currentCents: existingOther?.currentCents ?? 0,
    previousCents: existingOther?.previousCents ?? 0,
    isOther: true,
  };
  for (const row of tail) {
    folded.currentCents += row.currentCents;
    folded.previousCents += row.previousCents;
  }
  return [...head, folded]
    .filter((row) => row.currentCents !== 0 || row.previousCents !== 0)
    .sort(compareCategories(locale));
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

  const ids = new Set<string | null>([...currentByCategory.keys(), ...previousByCategory.keys()]);
  const buckets = new Map<string, YearCategoryComparison>();
  for (const id of ids) {
    const category = id ? byId.get(id) : undefined;
    const rawLabel = !category
      ? copy.uncategorized
      : copy.locale === "th"
        ? category.name_th
        : category.name_en;
    const catchAll =
      !id ||
      !category ||
      isCatchAllLabel(category.name_th, copy) ||
      isCatchAllLabel(category.name_en, copy) ||
      isCatchAllLabel(rawLabel, copy);
    const key = catchAll ? "other" : normalizeLabel(rawLabel);
    const currentCents = currentByCategory.get(id) ?? 0;
    const previousCents = previousByCategory.get(id) ?? 0;
    const existing = buckets.get(key);
    if (existing) {
      existing.currentCents += currentCents;
      existing.previousCents += previousCents;
      continue;
    }
    buckets.set(key, {
      id: catchAll ? "other" : id!,
      label: catchAll ? copy.other : rawLabel,
      currentCents,
      previousCents,
      isOther: catchAll,
    });
  }

  const ranked = [...buckets.values()]
    .filter((row) => row.currentCents !== 0 || row.previousCents !== 0)
    .sort(compareCategories(copy.locale));
  const categoriesOut = foldHomeYearCategories(ranked, copy.other, copy.locale);

  return {
    incomeCents,
    expenseCents,
    savedCents,
    categories: categoriesOut,
    insight: categoryInsight(categoriesOut),
  };
}
