import type { BankCode } from "./banks";

export interface SlipParty {
  name: string | null;
  /** Original masking retained; only numeric OCR glyphs are corrected. */
  account: string | null;
  bank: BankCode | null;
}
export interface ParsedSlip {
  /** Nonnegative safe integer satang. */
  amount: number | null;
  fee: number | null;
  /** Bangkok ISO timestamp; null when date OR time is absent/invalid. */
  dateTime: string | null;
  /** Calendar date retained for slips without a time. */
  date: string | null;
  sender: SlipParty;
  receiver: SlipParty;
  reference: string | null;
  confidence: Record<"amount" | "fee" | "date" | "dateTime" | "senderName" | "senderAccount" | "senderBank" | "receiverName" | "receiverAccount" | "receiverBank" | "reference", number>;
  overallConfidence: number;
}
export interface ParseSlipOptions {
  /** Fixed default 2026; only resolves ambiguous two-digit CE/BE years. */
  referenceYear?: number;
}
/** Compatible with database Transaction; account/bank hints may be enriched by callers.
 * transaction_date is a calendar date or ISO timestamp. created_at is never used.
 */
export interface SlipTransaction {
  id: string;
  amount: string;
  type: string;
  transaction_date: string;
  currency_code?: string;
  reference?: string | null;
  account?: string | null;
  bank?: BankCode | null;
}
export type MatchReason = "amount_exact" | "amount_within_tolerance" | "date_within_window" | "time_within_window" | "direction_match" | "direction_mismatch" | "account_match" | "account_mismatch" | "bank_match" | "bank_mismatch" | "reference_match" | "duplicate_reference" | "duplicate_amount_time";
export interface SlipMatch<T extends SlipTransaction = SlipTransaction> {
  transaction: T;
  score: number;
  reasons: MatchReason[];
  likelyDuplicate: boolean;
}
export interface MatchSlipOptions {
  amountToleranceMinor?: number;
  /** Timestamp window, default 24 hours; calendar-only rows use Bangkok day distance. */
  timeWindowMinutes?: number;
  duplicateWindowSeconds?: number;
  /** Which slip party owns the transactions and optional account/bank hints. Default sender. */
  perspective?: "sender" | "receiver";
}
