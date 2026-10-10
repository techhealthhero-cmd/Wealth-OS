import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { BOOK_SECTIONS, bookNeighbour, JOURNAL_BOOK } from "@/components/layout/journal-book";

/** The tab hrefs a tabs file declares, in order. */
function tabHrefs(file: string): string[] {
  const source = readFileSync(resolve("src/components/layout", file), "utf8");
  return [...source.matchAll(/\{\s*href:\s*"([^"]+)"/g)].map((m) => m[1]);
}

describe("journal book order", () => {
  it("each section matches its tab strip, in order", () => {
    expect(BOOK_SECTIONS[1]).toEqual(tabHrefs("money-tabs.tsx"));
    expect(BOOK_SECTIONS[2]).toEqual(tabHrefs("plan-tabs.tsx"));
    expect(BOOK_SECTIONS[3]).toEqual(tabHrefs("earn-tabs.tsx"));
  });

  it("turns across sections and stops at the ends", () => {
    expect(JOURNAL_BOOK[0]).toBe("/dashboard");
    expect(bookNeighbour("/dashboard", 1)).toBe("/money/transactions");
    expect(bookNeighbour("/money/transactions", -1)).toBe("/dashboard");
    expect(bookNeighbour("/money/subscriptions", 1)).toBe("/plan/goals");
    expect(bookNeighbour("/plan/forecast", 1)).toBe("/earn");
    expect(bookNeighbour("/earn", -1)).toBe("/plan/forecast");
    expect(bookNeighbour("/earn/income", 1)).toBeNull();
    expect(bookNeighbour("/dashboard", -1)).toBeNull();
    expect(bookNeighbour("/profile", 1)).toBeNull();
  });
});
