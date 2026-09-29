import { z } from "zod";

export const CSV_IMPORT_MAX_BYTES = 750 * 1024;
export const CSV_IMPORT_MAX_ROWS = 2_000;
export const CSV_IMPORT_MAX_COLUMNS = 80;
export const CSV_IMPORT_MAX_CELL_CHARS = 10_000;

export const importCanonicalFieldSchema = z.enum([
  "date",
  "description",
  "amount",
  "type",
  "debit",
  "credit",
  "reference",
  "currency",
  "balance",
]);

export type ImportCanonicalField = z.infer<typeof importCanonicalFieldSchema>;

export const importHeaderMappingSchema = z.object({
  date: z.string().min(1),
  description: z.string().min(1),
  amount: z.string().min(1).nullable().optional(),
  type: z.string().min(1).nullable().optional(),
  debit: z.string().min(1).nullable().optional(),
  credit: z.string().min(1).nullable().optional(),
  reference: z.string().min(1).nullable().optional(),
  currency: z.string().min(1).nullable().optional(),
  balance: z.string().min(1).nullable().optional(),
}).superRefine((mapping, ctx) => {
  const hasAmount = Boolean(mapping.amount);
  const hasDebitCredit = Boolean(mapping.debit || mapping.credit);
  if (hasAmount === hasDebitCredit) {
    ctx.addIssue({
      code: "custom",
      message: "Map either amount or debit/credit columns, but not both",
      path: ["amount"],
    });
  }
  if (hasAmount && !mapping.type) {
    // Signed amounts are supported without a type column, but positive
    // amounts are deliberately rejected row-by-row as ambiguous.
    return;
  }
});

export type ImportHeaderMapping = z.infer<typeof importHeaderMappingSchema>;

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export type CsvParseErrorCode =
  | "empty_file"
  | "file_too_large"
  | "binary_file"
  | "malformed_csv"
  | "too_many_rows"
  | "too_many_columns"
  | "cell_too_large"
  | "duplicate_header";

export class CsvParseError extends Error {
  constructor(public readonly code: CsvParseErrorCode, message: string) {
    super(message);
    this.name = "CsvParseError";
  }
}

/**
 * RFC-4180-compatible-enough parser for V1 statements: BOM, CRLF/LF,
 * quoted delimiters/newlines and doubled quote escapes. It never evaluates
 * cells, so spreadsheet formula prefixes remain inert data.
 */
export function parseStatementCsv(input: string, byteLength = new TextEncoder().encode(input).byteLength): ParsedCsv {
  if (byteLength === 0 || input.length === 0) throw new CsvParseError("empty_file", "CSV file is empty");
  if (byteLength > CSV_IMPORT_MAX_BYTES) throw new CsvParseError("file_too_large", "CSV file is too large");
  if (/\0/.test(input) || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(input)) {
    throw new CsvParseError("binary_file", "Binary data is not a CSV file");
  }

  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const matrix: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  const pushCell = () => {
    if (cell.length > CSV_IMPORT_MAX_CELL_CHARS) throw new CsvParseError("cell_too_large", "CSV cell is too large");
    row.push(cell);
    cell = "";
    if (row.length > CSV_IMPORT_MAX_COLUMNS) throw new CsvParseError("too_many_columns", "CSV has too many columns");
  };
  const pushRow = () => {
    pushCell();
    if (row.some((value) => value.trim() !== "")) matrix.push(row);
    row = [];
    if (matrix.length > CSV_IMPORT_MAX_ROWS + 1) throw new CsvParseError("too_many_rows", "CSV has too many rows");
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      if (cell.length !== 0) throw new CsvParseError("malformed_csv", "Unexpected quote in CSV cell");
      quoted = true;
    } else if (char === ",") {
      pushCell();
    } else if (char === "\n") {
      pushRow();
    } else if (char === "\r") {
      if (text[i + 1] === "\n") i += 1;
      pushRow();
    } else {
      cell += char;
    }
  }
  if (quoted) throw new CsvParseError("malformed_csv", "Unclosed quoted CSV cell");
  if (cell.length || row.length) pushRow();
  if (matrix.length < 2) throw new CsvParseError("empty_file", "CSV must contain a header and at least one row");

  const headers = matrix[0].map((header) => header.trim());
  if (headers.some((header) => !header)) throw new CsvParseError("malformed_csv", "CSV headers cannot be empty");
  const normalized = headers.map(normalizeHeader);
  if (new Set(normalized).size !== normalized.length) {
    throw new CsvParseError("duplicate_header", "CSV headers must be unique");
  }

  return {
    headers,
    rows: matrix.slice(1).map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))
    ),
  };
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

const HEADER_ALIASES: Record<ImportCanonicalField, readonly string[]> = {
  date: ["date", "transactiondate", "วันที่", "วันทำรายการ"],
  description: ["description", "details", "detail", "merchant", "memo", "รายการ", "รายละเอียด", "ร้านค้า"],
  amount: ["amount", "transactionamount", "จำนวนเงิน", "ยอดเงิน"],
  type: ["type", "transactiontype", "ชนิด", "ประเภท"],
  debit: ["debit", "withdrawal", "withdraw", "ถอน", "รายจ่าย", "เดบิต"],
  credit: ["credit", "deposit", "ฝาก", "รายรับ", "เครดิต"],
  reference: ["reference", "referenceid", "ref", "เลขอ้างอิง", "อ้างอิง"],
  currency: ["currency", "currencycode", "สกุลเงิน"],
  balance: ["balance", "runningbalance", "ยอดคงเหลือ"],
};

export function detectHeaderMapping(headers: readonly string[]): Partial<ImportHeaderMapping> {
  const result: Partial<ImportHeaderMapping> = {};
  const normalizedHeaders = headers.map((header) => ({ header, normalized: normalizeHeader(header) }));
  for (const field of importCanonicalFieldSchema.options) {
    const aliases = HEADER_ALIASES[field];
    const match = normalizedHeaders.find(({ normalized }) => aliases.includes(normalized));
    if (match) result[field] = match.header;
  }
  // Do not auto-select amount together with a detected debit/credit model.
  if (result.debit || result.credit) {
    delete result.amount;
    delete result.type;
  }
  return result;
}

