import { parseMoneyToCents } from "@/lib/financial/money";
import type { MatchReason, MatchSlipOptions, ParsedSlip, SlipMatch, SlipTransaction } from "./types";

const DAY = 86_400_000;
function nonnegative(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : fallback;
}
function reference(value: string | null | undefined): string | null {
  return value?.trim().toUpperCase() || null;
}
/** Compare visible suffix only: masking positions and punctuation carry no identity evidence. */
function suffix(value: string): string {
  return value.replace(/\D/g, "").slice(-4);
}
function timestamp(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return null;
  const day = value.slice(0, 10);
  const dayDate = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(dayDate.getTime()) || dayDate.toISOString().slice(0, 10) !== day) return null;
  const time = Date.parse(value.length === 10 ? `${value}T00:00:00+07:00` : value);
  return Number.isFinite(time) ? time : null;
}

/** Ranked suggestions, never an instruction to delete/merge a transaction.
 * Amount and date windows gate candidates, except identical references (which may
 * reveal inconsistent records). Duplicate time evidence requires actual timestamps.
 */
export function matchSlipToTransactions<T extends SlipTransaction>(
  slip: ParsedSlip, transactions: readonly T[], options: MatchSlipOptions = {},
): SlipMatch<T>[] {
  const amountTolerance = Math.floor(nonnegative(options.amountToleranceMinor, 0));
  const window = nonnegative(options.timeWindowMinutes, 1440) * 60_000;
  const duplicateWindow = nonnegative(options.duplicateWindowSeconds, 60) * 1000;
  const perspective = options.perspective ?? "sender";
  const expectedType = perspective === "sender" ? "expense" : "income";
  const party = slip[perspective];
  const slipTime = timestamp(slip.dateTime ?? slip.date ?? "");
  const matches: (SlipMatch<T> & { index: number })[] = [];
  transactions.forEach((transaction, index) => {
    if (transaction.currency_code && transaction.currency_code !== "THB") return;
    let cents: number;
    try { cents = parseMoneyToCents(transaction.amount); } catch { return; }
    if (!Number.isSafeInteger(cents) || cents < 0) return;
    const sameReference = reference(slip.reference) !== null && reference(slip.reference) === reference(transaction.reference);
    const exact = slip.amount !== null && slip.amount === cents;
    const amountMatch = slip.amount !== null && Math.abs(slip.amount - cents) <= amountTolerance;
    const transactionTime = timestamp(transaction.transaction_date);
    const hasTimes = Boolean(slip.dateTime && transaction.transaction_date.length > 10);
    let distance: number | null = null;
    if (slipTime !== null && transactionTime !== null) {
      // Timestamp rows compared to date-only slips use Bangkok calendar dates too.
      const bangkokDay = (value: number) => Math.floor((value + 7 * 3_600_000) / DAY);
      distance = hasTimes ? Math.abs(slipTime - transactionTime) : Math.abs(bangkokDay(slipTime) - bangkokDay(transactionTime)) * DAY;
    }
    if (!sameReference && (!amountMatch || (distance !== null && distance > window))) return;
    if (!sameReference && slip.amount === null) return;
    const reasons: MatchReason[] = [];
    let score = 0;
    if (amountMatch) { score += exact ? 0.45 : 0.35; reasons.push(exact ? "amount_exact" : "amount_within_tolerance"); }
    if (distance !== null && distance <= window) {
      score += 0.25 * (window === 0 ? 1 : 1 - 0.5 * distance / window);
      reasons.push(hasTimes ? "time_within_window" : "date_within_window");
    }
    const directionMatches = transaction.type === expectedType;
    reasons.push(directionMatches ? "direction_match" : "direction_mismatch");
    score += directionMatches ? 0.1 : -0.2;
    if (party.account && transaction.account) {
      const left = suffix(party.account), right = suffix(transaction.account);
      if (left.length >= 3 && right.length >= 3) {
        const length = Math.min(left.length, right.length);
        const same = left.slice(-length) === right.slice(-length);
        score += same ? 0.1 : -0.1;
        reasons.push(same ? "account_match" : "account_mismatch");
      }
    }
    if (party.bank && transaction.bank) {
      const same = party.bank === transaction.bank;
      score += same ? 0.1 : -0.1;
      reasons.push(same ? "bank_match" : "bank_mismatch");
    }
    const duplicateTime = exact && hasTimes && distance !== null && distance <= duplicateWindow && directionMatches;
    if (sameReference) { score = Math.max(score, 0.95); reasons.push("reference_match", "duplicate_reference"); }
    if (duplicateTime) reasons.push("duplicate_amount_time");
    matches.push({ transaction, score: Math.max(0, Math.min(1, score)), reasons, likelyDuplicate: sameReference || duplicateTime, index });
  });
  return matches.sort((a, b) => b.score - a.score || a.index - b.index).map(({ index: _index, ...match }) => {
    void _index;
    return match;
  });
}
