/**
 * Income by source — DISPLAY-ONLY AGGREGATION for the Home "income this
 * month" card. Pure, no I/O: it only groups and sums income transactions
 * that were already loaded (see getIncomeBySourceData in
 * features/dashboard/queries.ts). It is not a money formula — every sum goes
 * through the existing calculateIncome()/parseMoneyToCents() helpers, all
 * amounts are integer cents, and nothing here is persisted or fed back into
 * any other financial calculation.
 *
 * "Source" means the real, received income transactions grouped by:
 *   1. the Earn income path the transaction is linked to (earn_transaction_links),
 *   2. else its income category,
 *   3. else one "uncategorized" group.
 * `income_sources` rows are planning figures only and are never read here.
 */
import type { TransactionType } from "@/types/database";
import { calculateIncome } from "@/lib/financial/calculations";
import { calendarMonth } from "@/lib/date";

/** The 6 previous complete calendar months are the comparison window. */
export const INCOME_HISTORY_MONTHS = 6;
/** Named groups shown before the rest is merged into "Other". */
export const INCOME_TOP_GROUPS = 4;

export interface IncomeSourceTransaction {
  id: string;
  type: TransactionType;
  amount: string | number;
  /** "YYYY-MM-DD" */
  transaction_date: string;
  category_id: string | null;
}

export type IncomeGroupKind = "path" | "category" | "uncategorized" | "other";
export type IncomeVolatility = "steady" | "moderate" | "high";

export interface IncomeSourceGroup {
  key: string;
  kind: IncomeGroupKind;
  /** Display name, already localized (path title, category name, or the uncategorized/other label). */
  name: string;
  /** 0..3 for named groups by rank; "other" for the merged tail. Drives a stable color. */
  colorSlot: number | "other";
  thisMonthCents: number;
  /** Sum over the history window. */
  windowTotalCents: number;
  /** null when there is no history window. */
  averageCents: number | null;
  /** Share of all window income, percent with one decimal; null without window income. */
  sharePercent: number | null;
  /** This month vs this group's average, whole percent; null when avg is 0 or < 2 months. */
  percentOfAverage: number | null;
  /** True when percentOfAverage exists and this month already reached the group's average. */
  reachedAverage: boolean;
}

export interface IncomeBySourceSummary {
  /** "YYYY-MM" of `today`. */
  monthKey: string;
  thisMonthCents: number;
  /** Number of history months counted (0..6). */
  monthsInWindow: number;
  /** "YYYY-MM" of the first counted month, null when monthsInWindow is 0. */
  windowStartMonth: string | null;
  /** Per-month totals over the window, oldest first (zero months included). */
  monthlyTotals: { monthKey: string; incomeCents: number }[];
  /** round(window sum / monthsInWindow); null when monthsInWindow is 0. */
  averageCents: number | null;
  /** This month vs average, whole percent; null when avg is 0 or monthsInWindow < 2. */
  receivedPercentOfAverage: number | null;
  /** average - this month, only when receivedPercentOfAverage exists and this month is below it. */
  gapToAverageCents: number | null;
  /** Top groups (max 4) + an optional merged "other" group, ranked. */
  groups: IncomeSourceGroup[];
  /** Only when monthsInWindow >= 3. */
  range: { months: number; minCents: number; maxCents: number } | null;
  /** Coefficient of variation bucket; only when monthsInWindow >= 3 and mean > 0. */
  volatility: { level: IncomeVolatility; coefficient: number } | null;
  /** Largest real group carrying more than 50% of window income (>= 2 months of data). */
  concentration: { key: string; name: string; sharePercent: number } | null;
}

export interface AggregateIncomeBySourceInput {
  /**
   * "YYYY-MM-DD" — the user's calendar "today" (todayInTimeZone with the
   * profile's time zone), never the server's. The current month is measured to it.
   */
  today: string;
  /** Income transactions for the window + current month. Other types are ignored. */
  transactions: IncomeSourceTransaction[];
  /** "YYYY-MM" of the user's earliest transaction of any type; null when they have none. */
  trackingStartMonth: string | null;
  /** transaction id → linked Earn path. */
  pathLinks: ReadonlyMap<string, { pathId: string; title: string }>;
  /** category id → localized name. */
  categoryNames: ReadonlyMap<string, string>;
  labels: { uncategorized: string; other: string };
}

/** "YYYY-MM" shifted by `delta` months. */
export function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const index = year * 12 + (month - 1) + delta;
  const y = Math.floor(index / 12);
  const m = index - y * 12 + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** The previous INCOME_HISTORY_MONTHS complete months before `today`, oldest first. */
export function getHistoryMonthKeys(today: string): string[] {
  const current = today.slice(0, 7);
  return Array.from({ length: INCOME_HISTORY_MONTHS }, (_, i) => shiftMonthKey(current, i - INCOME_HISTORY_MONTHS));
}

/** Inclusive "YYYY-MM-DD" date range to load: 1st of the oldest history month through `today`. */
export function getIncomeQueryRange(today: string): { from: string; to: string } {
  return { from: calendarMonth(today, -INCOME_HISTORY_MONTHS).from, to: today };
}

/**
 * Header facts for the current month of `today` (a user-calendar date).
 * `monthDate` is UTC midnight of the 1st — format it with `timeZone: "UTC"`.
 */
export function getMonthProgress(today: string): { daysLeft: number; monthDate: Date } {
  const { dayOfMonth, daysInMonth, monthDate } = calendarMonth(today);
  return { daysLeft: Math.max(0, daysInMonth - dayOfMonth), monthDate };
}

/** "YYYY-MM-DD" | null (earliest transaction date) → "YYYY-MM" | null. */
export function toTrackingStartMonth(earliestTransactionDate: string | null | undefined): string | null {
  return earliestTransactionDate ? earliestTransactionDate.slice(0, 7) : null;
}

function classifyVolatility(coefficient: number): IncomeVolatility {
  if (coefficient < 0.15) return "steady";
  if (coefficient < 0.35) return "moderate";
  return "high";
}

function sharePercent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

interface MutableGroup {
  key: string;
  kind: Exclude<IncomeGroupKind, "other">;
  name: string;
  thisMonth: IncomeSourceTransaction[];
  byMonth: Map<string, IncomeSourceTransaction[]>;
}

export function aggregateIncomeBySource(input: AggregateIncomeBySourceInput): IncomeBySourceSummary {
  const monthKey = input.today.slice(0, 7);
  const historyKeys = getHistoryMonthKeys(input.today);

  // Window = max(first history month, tracking start month) .. last history
  // month. Months before the user started tracking aren't "zero income",
  // they're unknown; tracked months with no income are real zeros.
  const start = input.trackingStartMonth;
  const firstTracked = start === null ? -1 : historyKeys.findIndex((key) => key >= start);
  const windowKeys = firstTracked === -1 ? [] : historyKeys.slice(firstTracked);
  const windowSet = new Set(windowKeys);
  const monthsInWindow = windowKeys.length;

  const groups = new Map<string, MutableGroup>();
  const thisMonthAll: IncomeSourceTransaction[] = [];
  const windowByMonth = new Map<string, IncomeSourceTransaction[]>();

  for (const tx of input.transactions) {
    if (tx.type !== "income") continue;
    const txMonth = tx.transaction_date.slice(0, 7);
    const isThisMonth = txMonth === monthKey && tx.transaction_date <= input.today;
    const inWindow = windowSet.has(txMonth);
    if (!isThisMonth && !inWindow) continue;

    const link = input.pathLinks.get(tx.id);
    const categoryName = tx.category_id ? input.categoryNames.get(tx.category_id) : undefined;
    const descriptor: Pick<MutableGroup, "key" | "kind" | "name"> = link
      ? { key: `path:${link.pathId}`, kind: "path", name: link.title }
      : categoryName && tx.category_id
        ? { key: `category:${tx.category_id}`, kind: "category", name: categoryName }
        : { key: "uncategorized", kind: "uncategorized", name: input.labels.uncategorized };

    let group = groups.get(descriptor.key);
    if (!group) {
      group = { ...descriptor, thisMonth: [], byMonth: new Map() };
      groups.set(descriptor.key, group);
    }

    if (isThisMonth) {
      group.thisMonth.push(tx);
      thisMonthAll.push(tx);
    } else {
      const bucket = group.byMonth.get(txMonth);
      if (bucket) bucket.push(tx);
      else group.byMonth.set(txMonth, [tx]);
      const all = windowByMonth.get(txMonth);
      if (all) all.push(tx);
      else windowByMonth.set(txMonth, [tx]);
    }
  }

  const monthlyTotals = windowKeys.map((key) => ({
    monthKey: key,
    incomeCents: calculateIncome(windowByMonth.get(key) ?? []),
  }));
  const windowTotal = monthlyTotals.reduce((sum, m) => sum + m.incomeCents, 0);
  const thisMonthCents = calculateIncome(thisMonthAll);
  const averageCents = monthsInWindow > 0 ? Math.round(windowTotal / monthsInWindow) : null;

  const percentOf = (value: number, avg: number | null): number | null =>
    avg !== null && avg > 0 && monthsInWindow >= 2 ? Math.round((value / avg) * 100) : null;

  const receivedPercentOfAverage = percentOf(thisMonthCents, averageCents);
  const gapToAverageCents =
    receivedPercentOfAverage !== null && averageCents !== null && thisMonthCents < averageCents
      ? averageCents - thisMonthCents
      : null;

  const toGroup = (
    base: Pick<IncomeSourceGroup, "key" | "kind" | "name" | "colorSlot">,
    thisMonth: number,
    total: number
  ): IncomeSourceGroup => {
    const avg = monthsInWindow > 0 ? Math.round(total / monthsInWindow) : null;
    const pct = percentOf(thisMonth, avg);
    return {
      ...base,
      thisMonthCents: thisMonth,
      windowTotalCents: total,
      averageCents: avg,
      sharePercent: sharePercent(total, windowTotal),
      percentOfAverage: pct,
      reachedAverage: pct !== null && avg !== null && thisMonth >= avg,
    };
  };

  const ranked = [...groups.values()]
    .map((g) => ({
      group: g,
      thisMonth: calculateIncome(g.thisMonth),
      total: [...g.byMonth.values()].reduce((sum, txs) => sum + calculateIncome(txs), 0),
    }))
    .sort((a, b) => b.total - a.total || b.thisMonth - a.thisMonth || a.group.name.localeCompare(b.group.name));

  const top = ranked.slice(0, INCOME_TOP_GROUPS);
  const rest = ranked.slice(INCOME_TOP_GROUPS);
  const resultGroups = top.map((r, index) =>
    toGroup({ key: r.group.key, kind: r.group.kind, name: r.group.name, colorSlot: index }, r.thisMonth, r.total)
  );
  if (rest.length > 0) {
    resultGroups.push(
      toGroup(
        { key: "other", kind: "other", name: input.labels.other, colorSlot: "other" },
        rest.reduce((sum, r) => sum + r.thisMonth, 0),
        rest.reduce((sum, r) => sum + r.total, 0)
      )
    );
  }

  let range: IncomeBySourceSummary["range"] = null;
  let volatility: IncomeBySourceSummary["volatility"] = null;
  if (monthsInWindow >= 3) {
    const values = monthlyTotals.map((m) => m.incomeCents);
    range = { months: monthsInWindow, minCents: Math.min(...values), maxCents: Math.max(...values) };
    const mean = windowTotal / monthsInWindow;
    if (mean > 0) {
      const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / monthsInWindow;
      const coefficient = Math.sqrt(variance) / mean;
      volatility = { level: classifyVolatility(coefficient), coefficient };
    }
  }

  // Concentration names a real source — never the merged "other" bucket or
  // the "uncategorized" catch-all ("you rely on uncategorized" isn't advice).
  let concentration: IncomeBySourceSummary["concentration"] = null;
  const largest = ranked[0];
  if (monthsInWindow >= 2 && largest && windowTotal > 0 && largest.group.kind !== "uncategorized") {
    const share = largest.total / windowTotal;
    // Strictly more than half — matches the "over half" copy.
    if (share > 0.5) {
      concentration = {
        key: largest.group.key,
        name: largest.group.name,
        sharePercent: sharePercent(largest.total, windowTotal) ?? 0,
      };
    }
  }

  return {
    monthKey,
    thisMonthCents,
    monthsInWindow,
    windowStartMonth: windowKeys[0] ?? null,
    monthlyTotals,
    averageCents,
    receivedPercentOfAverage,
    gapToAverageCents,
    groups: resultGroups,
    range,
    volatility,
    concentration,
  };
}
