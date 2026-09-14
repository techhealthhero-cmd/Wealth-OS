/**
 * Upcoming Bills — deterministic date-window bucketing + duplicate-obligation
 * guarding, pulled out as pure functions so the windowing logic is testable
 * without a database.
 */

import { isOverdue } from "./recurring";

export interface BillItem {
  id: string;
  source: "recurring" | "liability";
  label: string;
  amountCents: number;
  dueDate: string;
  type: string;
}

export interface CategorizedBills {
  overdue: BillItem[];
  next7Days: BillItem[];
  next30Days: BillItem[];
  totalDueCents: number;
}

const WEEK_MS = 7 * 86_400_000;
const MONTH_MS = 30 * 86_400_000;

/**
 * Collapses items that look like the same real-world obligation entered
 * twice (same label, same due date, same amount) down to one — regardless
 * of which source (recurring template vs. liability) it came from. This
 * cannot detect every possible duplicate (a user is free to name things
 * differently), but it catches the exact-match case deterministically.
 */
export function deduplicateBillItems(items: BillItem[]): BillItem[] {
  const seen = new Set<string>();
  const result: BillItem[] = [];
  for (const item of items) {
    const key = `${item.label.trim().toLowerCase()}|${item.dueDate}|${item.amountCents}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

export function categorizeUpcomingBills(items: BillItem[], now: Date = new Date()): CategorizedBills {
  const deduped = deduplicateBillItems(items);

  const overdue: BillItem[] = [];
  const next7Days: BillItem[] = [];
  const next30Days: BillItem[] = [];

  for (const item of deduped) {
    const dueDate = new Date(item.dueDate);
    if (isOverdue(dueDate, now)) {
      overdue.push(item);
    } else if (dueDate.getTime() - now.getTime() <= WEEK_MS) {
      next7Days.push(item);
    } else if (dueDate.getTime() - now.getTime() <= MONTH_MS) {
      next30Days.push(item);
    }
  }

  const sortByDate = (a: BillItem, b: BillItem) => a.dueDate.localeCompare(b.dueDate);
  overdue.sort(sortByDate);
  next7Days.sort(sortByDate);
  next30Days.sort(sortByDate);

  const totalDueCents = [...overdue, ...next7Days].reduce((sum, item) => sum + item.amountCents, 0);

  return { overdue, next7Days, next30Days, totalDueCents };
}
