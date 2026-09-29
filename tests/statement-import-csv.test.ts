import { describe, expect, it } from "vitest";

import {
  CSV_IMPORT_MAX_BYTES,
  CSV_IMPORT_MAX_ROWS,
  CsvParseError,
  detectHeaderMapping,
  parseStatementCsv,
} from "@/lib/import/csv";

describe("statement CSV parsing", () => {
  it("reads English headers, quoted commas, escaped quotes and CRLF", () => {
    const parsed = parseStatementCsv('date,description,amount,type\r\n2026-09-01,"Fuji, Central",1280,expense\r\n2026-09-02,"Joe""s",500,income\r\n');
    expect(parsed.headers).toEqual(["date", "description", "amount", "type"]);
    expect(parsed.rows).toEqual([
      { date: "2026-09-01", description: "Fuji, Central", amount: "1280", type: "expense" },
      { date: "2026-09-02", description: 'Joe"s', amount: "500", type: "income" },
    ]);
  });

  it("reads UTF-8 BOM, Thai headers/text and LF", () => {
    const parsed = parseStatementCsv("\uFEFFวันที่,รายละเอียด,ถอน,ฝาก\n30/09/2569,ร้านข้าว,80,\n30/09/2569,เงินเดือน,,25000\n");
    expect(parsed.rows[0].รายละเอียด).toBe("ร้านข้าว");
    expect(detectHeaderMapping(parsed.headers)).toEqual({
      date: "วันที่",
      description: "รายละเอียด",
      debit: "ถอน",
      credit: "ฝาก",
    });
  });

  it("preserves formula-looking cells as inert strings", () => {
    const parsed = parseStatementCsv("date,description,amount,type\n2026-09-01,=HYPERLINK(1),10,expense\n");
    expect(parsed.rows[0].description).toBe("=HYPERLINK(1)");
  });

  it("rejects binary, malformed, duplicate-header and over-limit input", () => {
    expect(() => parseStatementCsv("date,description\0\n1,a\n")).toThrowError(CsvParseError);
    expect(() => parseStatementCsv('date,description\n1,"open\n')).toThrowError(CsvParseError);
    expect(() => parseStatementCsv("date, date\n1,2\n")).toThrowError(CsvParseError);
    expect(() => parseStatementCsv("a,b\n1,2\n", CSV_IMPORT_MAX_BYTES + 1)).toThrowError(CsvParseError);
  });

  it("accepts 1,000 rows and rejects unreasonable row counts", () => {
    const make = (count: number) => `date,description,amount,type\n${Array.from({ length: count }, (_, i) => `2026-09-01,row${i},1,expense`).join("\n")}`;
    expect(parseStatementCsv(make(1_000)).rows).toHaveLength(1_000);
    expect(() => parseStatementCsv(make(CSV_IMPORT_MAX_ROWS + 1))).toThrowError(CsvParseError);
  });
});

