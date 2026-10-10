/**
 * The journal as one book (2026-10-11, requested): Home is its first page,
 * then every Money tab, every Plan tab, every Earn tab, in the order their
 * tab strips show them. Swiping right-to-left turns to the next page across
 * sections; left-to-right turns back, and before Home the cover closes.
 *
 * The section lists must match each section's tab strip (money-tabs.tsx,
 * plan-tabs.tsx, earn-tabs.tsx) — tests/journal-book.test.ts checks it.
 */
export const BOOK_SECTIONS: readonly (readonly string[])[] = [
  ["/dashboard"],
  [
    "/money/transactions",
    "/money/accounts",
    "/money/import",
    "/money/budget",
    "/money/assets",
    "/money/liabilities",
    "/money/net-worth",
    "/money/recurring",
    "/money/subscriptions",
  ],
  ["/plan/goals", "/plan/emergency-fund", "/plan/money-year", "/plan/debt", "/plan/forecast"],
  ["/earn", "/earn/missions", "/earn/income"],
];

export const JOURNAL_BOOK: readonly string[] = BOOK_SECTIONS.flat();

/** The page before/after `href` in the whole book, or null at either end. */
export function bookNeighbour(href: string, dir: 1 | -1): string | null {
  const i = JOURNAL_BOOK.indexOf(href);
  if (i < 0) return null;
  return JOURNAL_BOOK[i + dir] ?? null;
}
