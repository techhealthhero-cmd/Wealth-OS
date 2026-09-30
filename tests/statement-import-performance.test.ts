import { describe, expect, it } from "vitest";
import { performance } from "node:perf_hooks";

import { parseStatementCsv } from "@/lib/import/csv";
import { normalizeImportRow } from "@/lib/import/normalize";

const categories = [
  { id: "food", name_th: "อาหาร", name_en: "Food & Dining", type: "expense" as const, icon: null, is_system: true },
  { id: "salary", name_th: "เงินเดือน", name_en: "Salary", type: "income" as const, icon: null, is_system: true },
  { id: "other-expense", name_th: "อื่นๆ", name_en: "Other", type: "expense" as const, icon: null, is_system: true },
  { id: "other-income", name_th: "อื่นๆ", name_en: "Other", type: "income" as const, icon: null, is_system: true },
];

describe.each([10, 100, 1_000])("statement import performance: %i rows", (rowCount) => {
  it("parses and normalizes without an obvious CPU bottleneck", () => {
    const csv = `date,description,debit,credit,reference\n${Array.from({ length: rowCount }, (_, i) =>
      i % 10 === 0
        ? `2026-09-01,เงินเดือน,,25000,IN-${i}`
        : `2026-09-01,อาหาร ${i},80,,OUT-${i}`
    ).join("\n")}`;
    const started = performance.now();
    const parsed = parseStatementCsv(csv);
    const normalized = parsed.rows.map((row) => normalizeImportRow(row, {
      date: "date",
      description: "description",
      debit: "debit",
      credit: "credit",
      reference: "reference",
    }, {
      accountId: "11111111-1111-4111-8111-111111111111",
      accountCurrency: "THB",
      categories,
      merchantPreferences: [],
    }));
    const elapsedMs = performance.now() - started;
    expect(normalized).toHaveLength(rowCount);
    expect(normalized.every((row) => row.status !== "error")).toBe(true);
    // A generous regression ceiling; this is not a microbenchmark contract.
    expect(elapsedMs).toBeLessThan(2_000);
  });
});

