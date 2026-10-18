import { CSV_IMPORT_MAX_BYTES, CSV_IMPORT_MAX_ROWS } from "../csv";
import { formatCents } from "./amounts";
import { PdfImportError, type StatementRow } from "./types";

function textCell(value: string): string {
  // Guard formula prefixes even after spreadsheet-ignored whitespace.
  const safe = /^\s*[=+@-]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Only text cells are formula-escaped; signed monetary cells stay numeric. */
export function statementRowsToCsv(rows: readonly StatementRow[]): string {
  if (rows.length > CSV_IMPORT_MAX_ROWS) throw new PdfImportError("too_many_rows", "รายการเกิน 2,000 แถว กรุณาแบ่งช่วงวันที่ / Maximum 2,000 rows.");
  const money = (cents: number | null) => cents === null ? "" : formatCents(cents);
  const csv = ["date,description,debit,credit,balance,reference", ...rows.map((row) => [
    textCell(row.date), textCell(row.description), money(row.debitCents), money(row.creditCents), money(row.balanceCents), textCell(row.reference ?? ""),
  ].join(","))].join("\r\n");
  if (new TextEncoder().encode(csv).byteLength > CSV_IMPORT_MAX_BYTES) throw new PdfImportError("csv_too_large", "ข้อมูล CSV ที่แปลงแล้วเกิน 750 KB กรุณาแบ่งช่วงวันที่ / Converted CSV exceeds 750 KB.");
  return csv;
}
