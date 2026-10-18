/**
 * Shared types for PDF bank-statement import.
 *
 * Everything under `src/lib/import/pdf/` is pure TypeScript: no pdfjs, no
 * DOM, no network. The browser-only text extraction lives in
 * `src/features/statement-import/pdf-extract.ts` and hands this module plain
 * positioned text, so every parser here is unit-testable with synthetic
 * fixtures. PDF bytes and passwords never reach this layer.
 */

/** One positioned text run as reported by the PDF text layer (PDF units, y grows upward). */
export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

/** A horizontal run of adjacent text items on one line (roughly one table cell). */
export interface PdfTextCell {
  text: string;
  x: number;
  xEnd: number;
}

export interface PdfTextLine {
  page: number;
  y: number;
  text: string;
  /** Present when built from real positioned items; absent for text-only fixtures. */
  cells?: PdfTextCell[];
}

export type StatementBankId = "kbank" | "scb" | "bbl" | "ktb" | "krungsri" | "ttb" | "gsb";
export type StatementParserId = StatementBankId | "generic";

/** One parsed statement row. Money is integer satang/cents — never floats. */
export interface StatementRow {
  /** ISO yyyy-mm-dd (Gregorian). */
  date: string;
  description: string;
  debitCents: number | null;
  creditCents: number | null;
  /** Signed running balance when the statement shows one. */
  balanceCents: number | null;
  reference: string | null;
}

export interface StatementParseResult {
  parser: StatementParserId;
  /** Bank detected from header keywords, even if the generic fallback produced the rows. */
  detectedBank: StatementBankId | null;
  rows: StatementRow[];
  /** Dated lines that looked like transactions but whose debit/credit direction could not be determined. */
  skippedLines: number;
}

export type PdfImportErrorCode =
  | "pdf_too_large"
  | "invalid_pdf"
  | "password_required"
  | "password_incorrect"
  | "no_text"
  | "unrecognized_layout"
  | "too_many_rows"
  | "csv_too_large";

export class PdfImportError extends Error {
  constructor(public readonly code: PdfImportErrorCode, message: string) {
    super(message);
    this.name = "PdfImportError";
  }
}
