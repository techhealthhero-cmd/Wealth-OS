import { describe, expect, it } from "vitest";
import { BANK_FIXTURES, fixtureLines } from "./fixtures/pdf-statements";
import { detectStatementBank, parseBankStatement, parseGenericStatement, parsePdfStatement } from "../src/lib/import/pdf/parsers";
import { linesFromText, groupTextItemsIntoLines } from "../src/lib/import/pdf/lines";
import { parseStatementDate, buddhistToGregorian } from "../src/lib/import/pdf/dates";
import { statementRowsToCsv } from "../src/lib/import/pdf/csv";
import { PdfImportError, type StatementBankId, type StatementRow } from "../src/lib/import/pdf/types";
import { detectHeaderMapping, parseStatementCsv } from "../src/lib/import/csv";

const row: StatementRow = { date: "2026-10-01", description: "synthetic", debitCents: 10000, creditCents: null, balanceCents: -5000, reference: null };

describe("best-effort bank profiles", () => {
  for (const bank of Object.keys(BANK_FIXTURES) as StatementBankId[]) {
    it(`detects and parses synthetic ${bank} credit and debit`, () => {
      const lines = fixtureLines(bank);
      expect(detectStatementBank(lines)).toBe(bank);
      const result = parseBankStatement(lines, bank, 2026);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].creditCents).toBeGreaterThan(0);
      expect(result.rows[1].debitCents).toBeGreaterThan(0);
      expect(result.rows.map((r) => r.date)).toEqual(["2026-10-01", "2026-10-02"]);
      expect(parsePdfStatement(lines, 2026).parser).toBe(bank);
    });
  }
  it.each([['ธนาคารกสิกรไทย', 'kbank'], ['ไทยพาณิชย์', 'scb'], ['ธนาคารกรุงไทย', 'ktb'], ['ธนาคารกรุงศรี', 'krungsri'], ['ทหารไทยธนชาต', 'ttb']])("detects Thai header %s", (header, bank) => {
    expect(detectStatementBank(linesFromText([header]))).toBe(bank);
  });
  it("does not detect a bank from a transfer recipient", () => {
    expect(detectStatementBank(linesFromText(["Statement", "01/10/26 transfer out SCB 100.00"])) ).toBeNull();
  });
});

describe("generic fallback and grouping", () => {
  it("uses signed amounts and CR/DR without bank keywords", () => {
    const result = parsePdfStatement(linesFromText(["Other Bank", "01/10/26 Shop -100.00 900.00", "02/10/26 Refund 50.00 CR 950.00"]), 2026);
    expect(result.parser).toBe("generic");
    expect(result.rows.map((r) => [r.debitCents, r.creditCents])).toEqual([[10000, null], [null, 5000]]);
  });
  it("uses debit/credit/balance text columns", () => {
    const result = parseGenericStatement(linesFromText(["01/10/26 Shop 100.00 0.00 900.00", "02/10/26 Salary 0.00 500.00 1400.00"]), 2026);
    expect(result.rows.map((r) => [r.debitCents, r.creditCents])).toEqual([[10000, null], [null, 50000]]);
  });
  it("infers a running balance delta and counts ambiguous rows", () => {
    const result = parseGenericStatement(linesFromText(["Opening balance 1000.00", "01/10/26 Example 100.00 900.00", "02/10/26 Unknown 42.00"]), 2026);
    expect(result.rows[0].debitCents).toBe(10000);
    expect(result.skippedLines).toBe(1);
  });
  it("does not reverse direction using a later oldest-first balance", () => {
    const result = parseGenericStatement(linesFromText(["01/10/26 ambiguous 100.00 900.00", "02/10/26 deposit 100.00 1000.00"]), 2026);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].creditCents).toBe(10000);
    expect(result.skippedLines).toBe(1);
  });
  it("handles newest-first running balances and explicit positive amounts", () => {
    const result = parseGenericStatement(linesFromText(["02/10/26 example 50.00 950.00", "01/10/26 purchase 100.00 900.00", "31/09/26 invalid +10.00"]), 2026);
    expect(result.rows[0].creditCents).toBe(5000);
    expect(parseGenericStatement(linesFromText(["01/10/26 example +10.00"]), 2026).rows[0].creditCents).toBe(1000);
  });
  it("groups by page/y, preserves columns and follows positioned header order", () => {
    const texts = [
      { y: 100, cells: [[0, "Date"], [100, "Description"], [300, "Credit"], [420, "Debit"], [540, "Balance"]] },
      { y: 80, cells: [[0, "01/10/26"], [100, "Example"], [300, "50.00"], [540, "950.00"]] },
    ];
    const lines = groupTextItemsIntoLines(texts.flatMap(({ y, cells }) => cells.map(([x, str]) => ({ x: Number(x), str: String(str), y, width: 50, height: 10, page: 1 }))));
    expect(lines).toHaveLength(2);
    expect(parseGenericStatement(lines, 2026).rows[0].creditCents).toBe(5000);
    expect(groupTextItemsIntoLines([{ str: "A", x: 0, y: 100, width: 5, height: 10, page: 2 }, { str: "B", x: 0, y: 100, width: 5, height: 10, page: 1 }]).map((l) => l.page)).toEqual([1, 2]);
  });
  it("throws a typed error for unknown or scanned layouts", () => {
    for (const text of [[], ["Unknown layout"], ["SCB", "01/10/26 ambiguous 100.00"]]) {
      try { parsePdfStatement(linesFromText(text), 2026); expect.fail("must reject"); }
      catch (error) { expect(error).toBeInstanceOf(PdfImportError); expect((error as PdfImportError).code).toBe("unrecognized_layout"); }
    }
  });
});

it.each([['01/10/2569', '2026-10-01'], ['01/10/69', '2026-10-01'], ['01/10/26', '2026-10-01'], ['๑ ต.ค. ๒๕๖๙', '2026-10-01'], ['29/02/2025', null], ['01 Jan 2026', '2026-01-01']])("parses date %s", (input, expected) => {
  expect(parseStatementDate(input, 2026)).toBe(expected);
  expect(buddhistToGregorian(2569)).toBe(2026);
});

describe("CSV bridge", () => {
  it("round-trips commas, quotes, newlines and maps the existing headers", () => {
    const csv = statementRowsToCsv([{ ...row, description: 'Example, "quoted"\nnext line' }]);
    const parsed = parseStatementCsv(csv);
    expect(parsed.rows[0].description).toBe('Example, "quoted"\nnext line');
    expect(parsed.rows[0].balance).toBe("-50.00");
    expect(detectHeaderMapping(parsed.headers)).toMatchObject({ date: "date", description: "description", debit: "debit", credit: "credit", balance: "balance", reference: "reference" });
  });
  it.each(["=SUM(A1)", "+cmd", "-cmd", "@cmd", "  =cmd", "\t+cmd"])("guards text formula %s while keeping amounts numeric", (text) => {
    const parsed = parseStatementCsv(statementRowsToCsv([{ ...row, description: text, reference: text }]));
    expect(parsed.rows[0].description).toBe(`'${text}`);
    expect(parsed.rows[0].reference).toBe(`'${text}`);
    expect(parsed.rows[0].debit).toBe("100.00");
    expect(parsed.rows[0].balance).toBe("-50.00");
  });
  it("enforces row and UTF-8 byte limits", () => {
    expect(() => statementRowsToCsv(Array.from({ length: 2001 }, () => row))).toThrow(expect.objectContaining({ code: "too_many_rows" }));
    expect(() => statementRowsToCsv(Array.from({ length: 2000 }, () => ({ ...row, description: "ก".repeat(300) })))).toThrow(expect.objectContaining({ code: "csv_too_large" }));
    expect(parseStatementCsv(statementRowsToCsv(Array.from({ length: 2000 }, () => row))).rows).toHaveLength(2000);
  });
});

 it.each(["purchase", "unknown"])("does not reverse same-day %s rows with unknown ordering", (description) => {
   const result = parseGenericStatement(linesFromText([`01/10/26 ${description} 100.00 900.00`, `01/10/26 ${description} 100.00 800.00`]), 2026);
   expect(result.rows.every((row) => row.creditCents === null)).toBe(true);
   if (description === "unknown") {
     expect(result.rows).toHaveLength(0);
     expect(result.skippedLines).toBe(2);
   } else expect(result.rows.map((row) => row.debitCents)).toEqual([10000, 10000]);
 });

it("rejects extra amounts rather than discarding a numeric description", () => {
  const result = parseGenericStatement(linesFromText(["01/10/26 purchase ref 42.00 100.00 0.00 900.00"]), 2026);
  expect(result).toEqual({ rows: [], skippedLines: 1 });
});

it("does not infer across rejected transaction rows", () => {
  const result = parseGenericStatement(linesFromText([
    "01/10/26 purchase 10.00 1000.00",
    "02/10/26 unclear 20.00 30.00 900.00",
    "03/10/26 unknown 100.00 900.00",
  ]), 2026);
  expect(result.rows).toHaveLength(1);
  expect(result.skippedLines).toBe(2);
});

it("rejects multiple positioned amounts assigned to one column", () => {
  const lines = groupTextItemsIntoLines([
    ...[[0, "Date"], [100, "Description"], [300, "Debit"], [420, "Credit"], [540, "Balance"]].map(([x, str]) => ({ x: Number(x), str: String(str), y: 100, width: 30, height: 10, page: 1 })),
    ...[[0, "01/10/26"], [100, "purchase"], [280, "10.00"], [330, "20.00"], [540, "900.00"]].map(([x, str]) => ({ x: Number(x), str: String(str), y: 80, width: 30, height: 10, page: 1 })),
  ]);
  expect(parseGenericStatement(lines, 2026)).toEqual({ rows: [], skippedLines: 1 });
});

it("preserves duplicate printed transactions for downstream duplicate review", () => {
  const result = parseGenericStatement(linesFromText(Array(2).fill("01/10/26 purchase 100.00")), 2026);
  expect(result.rows).toHaveLength(2);
});

it("uses explicit BE and CE years across December and January", () => {
  const result = parseGenericStatement(linesFromText(["31/12/68 purchase 100.00", "01/01/69 deposit 200.00"]), 2026);
  expect(result.rows.map((row) => row.date)).toEqual(["2025-12-31", "2026-01-01"]);
});

it("does not infer balances from statements with mixed date ordering", () => {
  const result = parseGenericStatement(linesFromText([
    "01/10/26 purchase 10.00 1000.00",
    "03/10/26 unknown 100.00 900.00",
    "02/10/26 deposit 50.00 950.00",
  ]), 2026);
  expect(result.rows.map((row) => row.description)).toEqual(["purchase", "deposit"]);
  expect(result.skippedLines).toBe(1);
});

it.each(["-1,234.56", "1,234.56-", "(1,234.56)", "1,234.56 Dr"])("reads debit amount %s", (amount) => {
  const result = parseGenericStatement(linesFromText([`01/10/26 example ${amount}`]), 2026);
  expect(result.rows[0].debitCents).toBe(123456);
});
