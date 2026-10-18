import { findAmountTokens, parseAmountCell, signedCents, type AmountToken } from "./amounts";
import { parseLeadingDate, thaiDigitsToArabic } from "./dates";
import type { PdfTextLine, StatementRow } from "./types";

/**
 * Shared, deterministic row engine used by every bank profile and by the
 * generic fallback. A bank profile only tunes keywords; the mechanics are:
 *
 * 1. A transaction line starts with a date. Undated, amount-free lines right
 *    after it are treated as wrapped description text.
 * 2. Amounts are two-decimal tokens. With positioned cells and a recognised
 *    column header, each amount is assigned to the nearest debit / credit /
 *    balance column. Otherwise the last amount is the running balance when
 *    two or more are present.
 * 3. Direction (debit vs credit) is decided by, in order: the column it sits
 *    in, an explicit sign / CR / DR marker, the running-balance delta against
 *    the neighbouring row (works for oldest-first and newest-first
 *    statements), and finally keyword hints in the description.
 * 4. Rows whose direction is still unknown are skipped and counted — never
 *    guessed — so the user sees fewer rows rather than wrong ones.
 *
 * This only extracts what the statement printed; amounts are never
 * recomputed. Normalisation and validation stay in `normalize.ts` on the
 * server, exactly as for an uploaded CSV.
 */
export interface StatementProfile {
  creditHints: readonly RegExp[];
  debitHints: readonly RegExp[];
  /** Lines carrying the opening balance (seeds the balance-delta check). */
  openingBalancePatterns: readonly RegExp[];
  /** Summary / footer lines that are never transactions. */
  skipPatterns: readonly RegExp[];
  /** Column order when a line shows two amount columns plus a balance. */
  threeAmountOrder: readonly ["debit", "credit"] | readonly ["credit", "debit"];
}

export const COMMON_CREDIT_HINTS: readonly RegExp[] = [
  /รับโอน|เงินโอนเข้า|โอนเข้า|ฝากเงิน|ฝากเงินสด|เงินเข้า|ดอกเบี้ยรับ|เงินเดือน|คืนเงิน/,
  /\b(?:deposit|transfer in|incoming|received|receive|salary|refund|interest credit|cash deposit)\b/i,
];

export const COMMON_DEBIT_HINTS: readonly RegExp[] = [
  /โอนเงินออก|โอนออก|ถอนเงิน|ถอน|ชำระ|จ่าย|ซื้อ|หักบัญชี|ค่าธรรมเนียม|เติมเงิน/,
  /\b(?:withdrawal|withdraw|transfer out|payment|purchase|bill|fee|debit card|atm)\b/i,
];

export const COMMON_OPENING_PATTERNS: readonly RegExp[] = [
  /ยอดยกมา|ยอดคงเหลือยกมา|ยอดเงินคงเหลือยกมา|ยอดเงินยกมา/,
  /\b(?:beginning balance|opening balance|balance brought forward|brought forward|balance forward|balance b\/f|b\/f)\b/i,
];

export const COMMON_SKIP_PATTERNS: readonly RegExp[] = [
  /ยอดยกไป|ยอดคงเหลือยกไป|รวมถอน|รวมฝาก|รวมรายการ|รวมทั้งสิ้น|ยอดรวม/,
  /\b(?:carried forward|balance c\/f|c\/f|ending balance|closing balance|total (?:debit|credit|withdrawal|deposit|amount)s?)\b/i,
];

const HEADER_DEBIT = /ถอน|เดบิต|withdraw|debit/i;
const HEADER_CREDIT = /ฝาก|เครดิต|deposit|credit/i;
const HEADER_BALANCE = /คงเหลือ|balance/i;
const NOISE_LINE = /^(?:page|หน้า(?:ที่)?)\s*\d|^\d+\s*\/\s*\d+$/i;
const TIME_PREFIX = /^\s*(?:\d{1,2}:\d{2}(?::\d{2})?(?:\s*น\.)?|\d{1,2}\.\d{2}\s*น\.)/;
const REFERENCE_RE = /(?:ref(?:erence)?\.?(?:\s*no\.?)?|เลขที่อ้างอิง|เลขอ้างอิง|อ้างอิง)\s*[:#]?\s*([A-Za-z0-9-]{4,40})/i;
const MAX_DESCRIPTION_CHARS = 300;

type Direction = "debit" | "credit";

interface Columns {
  debit?: number;
  credit?: number;
  balance?: number;
}

interface Candidate {
  date: string;
  page: number;
  parts: string[];
  amountCents: number | null;
  direction: Direction | null;
  balanceCents: number | null;
  /** True when direction came from columns/markers rather than inference. */
  explicit: boolean;
  chain: number;
}

export interface EngineOutput {
  rows: StatementRow[];
  skippedLines: number;
}

function cellCenter(cell: { x: number; xEnd: number }): number {
  return (cell.x + cell.xEnd) / 2;
}

function detectColumns(line: PdfTextLine): Columns | null {
  if (!line.cells || line.cells.length < 3 || findAmountTokens(line.text).length) return null;
  const columns: Columns = {};
  for (const cell of line.cells) {
    const text = thaiDigitsToArabic(cell.text);
    if (columns.balance === undefined && HEADER_BALANCE.test(text)) columns.balance = cellCenter(cell);
    else if (columns.debit === undefined && HEADER_DEBIT.test(text)) columns.debit = cellCenter(cell);
    else if (columns.credit === undefined && HEADER_CREDIT.test(text)) columns.credit = cellCenter(cell);
  }
  return columns.debit !== undefined && columns.credit !== undefined ? columns : null;
}

function isHeaderLine(text: string): boolean {
  return HEADER_DEBIT.test(text) && HEADER_CREDIT.test(text) && findAmountTokens(text).length === 0;
}

function matchesAny(patterns: readonly RegExp[], text: string): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function hintDirection(profile: StatementProfile, description: string): Direction | null {
  const credit = matchesAny(profile.creditHints, description);
  const debit = matchesAny(profile.debitHints, description);
  if (credit && !debit) return "credit";
  if (debit && !credit) return "debit";
  // "รับโอน" / "transfer in" are more specific than the generic "โอน" debit words.
  if (credit && debit) return /รับโอน|โอนเข้า|เงินเข้า|transfer in|incoming|received/i.test(description) ? "credit" : null;
  return null;
}

function stripTokens(text: string, tokens: readonly AmountToken[]): string {
  let result = text;
  for (const token of [...tokens].sort((a, b) => b.index - a.index)) {
    result = `${result.slice(0, token.index)} ${result.slice(token.index + token.length)}`;
  }
  return result;
}

/** Assigns positioned amount cells to columns; null if the line has no usable cells. */
function amountsFromColumns(line: PdfTextLine, columns: Columns, dateEnd: number) {
  if (!line.cells) return null;
  let debit: AmountToken | null = null;
  let credit: AmountToken | null = null;
  let balance: AmountToken | null = null;
  const textParts: string[] = [];
  let consumed = 0;
  const assigned = new Set<keyof Columns>();
  let ambiguous = false;
  for (const cell of line.cells) {
    const start = consumed;
    consumed += cell.text.length + 1;
    if (start + cell.text.length <= dateEnd) continue;
    const text = start < dateEnd ? cell.text.slice(dateEnd - start) : cell.text;
    const amount = parseAmountCell(thaiDigitsToArabic(text));
    if (!amount) {
      textParts.push(text);
      continue;
    }
    const center = cellCenter(cell);
    const options = (Object.entries(columns) as [keyof Columns, number][])
      .map(([name, x]) => ({ name, distance: Math.abs(x - center) }))
      .sort((a, b) => a.distance - b.distance);
    const nearest = options[0]?.name;
    if (nearest && assigned.has(nearest)) ambiguous = true;
    if (nearest) assigned.add(nearest);
    if (nearest === "debit") debit = amount;
    else if (nearest === "credit") credit = amount;
    else if (nearest === "balance") balance = amount;
  }
  return { debit, credit, balance, ambiguous, description: textParts.join(" ") };
}

export function runStatementEngine(
  lines: readonly PdfTextLine[],
  profile: StatementProfile,
  refYear: number
): EngineOutput {
  const candidates: Candidate[] = [];
  let openingBalance: number | null = null;
  let columns: Columns | null = null;
  let last: Candidate | null = null;
  let unresolved = 0;
  let chain = 0;

  for (const line of lines) {
    const text = thaiDigitsToArabic(line.text).replace(/\s+/g, " ").trim();
    if (!text) continue;
    const headerColumns = detectColumns(line);
    if (headerColumns) {
      columns = headerColumns;
      last = null;
      continue;
    }
    if (isHeaderLine(text) || NOISE_LINE.test(text)) {
      last = null;
      continue;
    }

    const amounts = findAmountTokens(text);
    if (matchesAny(profile.openingBalancePatterns, text)) {
      if (amounts.length && candidates.length === 0) openingBalance = signedCents(amounts[amounts.length - 1]);
      last = null;
      continue;
    }
    if (matchesAny(profile.skipPatterns, text)) {
      last = null;
      continue;
    }

    const date = parseLeadingDate(text, refYear);
    if (!date) {
      // A rejected dated row breaks balance adjacency, even if its date is invalid.
      if (/^\d{1,2}[/.-]\d{1,2}[/.-]/.test(text)) {
        unresolved += 1;
        chain += 1;
        last = null;
        continue;
      }
      if (last && last.page === line.page && amounts.length === 0 && text.length <= 120) last.parts.push(text);
      else last = null;
      continue;
    }

    let rest = text.slice(date.length);
    const time = TIME_PREFIX.exec(rest);
    if (time) rest = rest.slice(time[0].length);

    const candidate: Candidate = {
      date: date.iso,
      page: line.page,
      parts: [],
      amountCents: null,
      direction: null,
      balanceCents: null,
      explicit: false,
      chain,
    };

    const fromColumns = columns && line.cells ? amountsFromColumns({ ...line, text }, columns, text.length - rest.length) : null;
    if (fromColumns?.ambiguous) {
      unresolved += 1;
      chain += 1;
      last = null;
      continue;
    }
    if (fromColumns && (fromColumns.debit || fromColumns.credit)) {
      const { debit, credit, balance } = fromColumns;
      if (debit && credit && debit.cents && credit.cents) {
        unresolved += 1;
        chain += 1;
        last = null;
        continue;
      }
      const amount = debit && debit.cents ? debit : credit;
      candidate.amountCents = amount?.cents ?? null;
      candidate.direction = amount === debit ? "debit" : "credit";
      candidate.balanceCents = balance ? signedCents(balance) : null;
      candidate.explicit = true;
      candidate.parts.push(TIME_PREFIX.exec(fromColumns.description) ? fromColumns.description.replace(TIME_PREFIX, "") : fromColumns.description);
    } else {
      const tokens = findAmountTokens(rest);
      if (tokens.length === 0 || tokens.length > 3) {
        unresolved += 1;
        chain += 1;
        last = null;
        continue;
      }
      candidate.parts.push(stripTokens(rest, tokens));
      if (tokens.length >= 3) {
        const [first, second] = tokens.slice(-3);
        const balance = tokens[tokens.length - 1];
        const firstSet = first.cents !== 0;
        const secondSet = second.cents !== 0;
        if (firstSet === secondSet) {
          unresolved += 1;
          chain += 1;
          last = null;
          continue;
        }
        candidate.amountCents = firstSet ? first.cents : second.cents;
        candidate.direction = profile.threeAmountOrder[firstSet ? 0 : 1];
        candidate.balanceCents = signedCents(balance);
        candidate.explicit = true;
      } else {
        const amount = tokens[0];
        candidate.amountCents = amount.cents;
        candidate.balanceCents = tokens.length === 2 ? signedCents(tokens[1]) : null;
        if (amount.marker === "cr") candidate.direction = "credit";
        else if (amount.negative) candidate.direction = "debit";
        candidate.explicit = candidate.direction !== null;
      }
    }

    if (!candidate.amountCents) {
      unresolved += 1;
      chain += 1;
      last = null;
      continue;
    }
    candidates.push(candidate);
    last = candidate;
  }

  // Infer order from differing dates. Same-day-only statements have unknown
  // order: leave adjacent balances unused and rely on explicit data or hints.
  // Never use a later balance as if it
  // preceded an oldest-first transaction: that can reverse debit and credit.
  const differingPair = candidates.findIndex((row, i) => i > 0 && row.date !== candidates[i - 1].date);
  const initialDescending = differingPair < 0 ? null : candidates[differingPair].date < candidates[differingPair - 1].date;
  const mixedOrder = candidates.some((row, i) => i > 0 && row.date !== candidates[i - 1].date
    && (row.date < candidates[i - 1].date) !== initialDescending);
  const descending = mixedOrder ? null : initialDescending;
  // Pass 2: infer direction from running-balance deltas, then from keywords.
  for (let i = 0; i < candidates.length; i += 1) {
    const row = candidates[i];
    if (row.explicit || row.balanceCents === null || row.amountCents === null) continue;
    const amount = row.amountCents;
    const previous = i === 0 ? (row.chain === 0 ? openingBalance : null) : candidates[i - 1].chain === row.chain ? candidates[i - 1].balanceCents : null;
    const next = candidates[i + 1]?.chain === row.chain ? candidates[i + 1].balanceCents : null;
    const possible = new Set<Direction>();
    if (descending === false && previous !== null) {
      if (previous - amount === row.balanceCents) possible.add("debit");
      if (previous + amount === row.balanceCents) possible.add("credit");
    }
    if (descending === true && next !== null) {
      if (next - amount === row.balanceCents) possible.add("debit");
      if (next + amount === row.balanceCents) possible.add("credit");
    }
    if (possible.size === 1) row.direction = [...possible][0];
  }

  const rows: StatementRow[] = [];
  for (const row of candidates) {
    const description = row.parts.join(" ").replace(/\s+/g, " ").trim().slice(0, MAX_DESCRIPTION_CHARS);
    const direction = row.direction ?? hintDirection(profile, description);
    if (!direction || row.amountCents === null) {
      unresolved += 1;
      continue;
    }
    rows.push({
      date: row.date,
      description,
      debitCents: direction === "debit" ? row.amountCents : null,
      creditCents: direction === "credit" ? row.amountCents : null,
      balanceCents: row.balanceCents,
      reference: REFERENCE_RE.exec(description)?.[1] ?? null,
    });
  }
  return { rows, skippedLines: unresolved };
}
