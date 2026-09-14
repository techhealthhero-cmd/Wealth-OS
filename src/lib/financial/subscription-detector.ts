/**
 * Subscription Detector — fully deterministic pattern matching over real
 * expense transactions. No AI/LLM involvement in detection (CLAUDE.md Day 6
 * spec: "Do not use AI for the detection algorithm"); AI may only explain an
 * already-detected pattern afterward.
 */

import type { RecurringFrequency, SubscriptionConfidence } from "@/types/database";

export interface SubscriptionTransactionInput {
  merchant: string;
  amountCents: number;
  date: Date;
}

export interface DetectedSubscriptionCandidate {
  merchant: string;
  estimatedAmountCents: number;
  frequency: RecurringFrequency;
  confidence: SubscriptionConfidence;
  occurrenceCount: number;
  firstSeenDate: Date;
  lastSeenDate: Date;
  nextExpectedDate: Date;
}

const MIN_OCCURRENCES = 2;
const AMOUNT_VARIANCE_TOLERANCE = 0.15; // (max - min) / median must stay under 15% to look like the "same" recurring charge

const FREQUENCY_BANDS: { frequency: RecurringFrequency; targetDays: number; toleranceDays: number }[] = [
  { frequency: "weekly", targetDays: 7, toleranceDays: 2 },
  { frequency: "biweekly", targetDays: 14, toleranceDays: 3 },
  { frequency: "monthly", targetDays: 30, toleranceDays: 5 },
  { frequency: "quarterly", targetDays: 91, toleranceDays: 10 },
  { frequency: "yearly", targetDays: 365, toleranceDays: 20 },
];

function normalizeMerchant(merchant: string): string {
  return merchant.trim().toLowerCase();
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function matchFrequencyBand(avgGapDays: number): { frequency: RecurringFrequency; toleranceDays: number } | null {
  return FREQUENCY_BANDS.find((band) => Math.abs(avgGapDays - band.targetDays) <= band.toleranceDays) ?? null;
}

/**
 * Analyzes a user's expense transactions and returns deterministic
 * subscription candidates. A merchant is never flagged from a single
 * transaction — `MIN_OCCURRENCES = 2` is the absolute floor, and a lone
 * repeat still only ever earns "low" confidence.
 */
export function detectSubscriptions(transactions: SubscriptionTransactionInput[]): DetectedSubscriptionCandidate[] {
  const groups = new Map<string, SubscriptionTransactionInput[]>();
  for (const t of transactions) {
    const key = normalizeMerchant(t.merchant);
    if (!key) continue;
    const bucket = groups.get(key) ?? [];
    bucket.push(t);
    groups.set(key, bucket);
  }

  const candidates: DetectedSubscriptionCandidate[] = [];

  for (const [, group] of groups) {
    if (group.length < MIN_OCCURRENCES) continue;

    const sorted = [...group].sort((a, b) => a.date.getTime() - b.date.getTime());
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(daysBetween(sorted[i - 1].date, sorted[i].date));
    }
    const avgGap = mean(gaps);
    const band = matchFrequencyBand(avgGap);
    if (!band) continue; // no recognizable recurring interval — a real recurring charge should land in one of the named bands

    const gapVariance = gaps.length > 0 ? Math.max(...gaps.map((g) => Math.abs(g - avgGap))) : 0;
    const gapConsistent = gapVariance <= band.toleranceDays;

    const amounts = sorted.map((t) => t.amountCents);
    const estimatedAmountCents = median(amounts);
    const amountSpread = estimatedAmountCents > 0 ? (Math.max(...amounts) - Math.min(...amounts)) / estimatedAmountCents : 0;
    const amountConsistent = amountSpread <= AMOUNT_VARIANCE_TOLERANCE;
    if (!amountConsistent) continue; // wildly different amounts from the same merchant is more likely coincidence than a subscription

    let confidence: SubscriptionConfidence;
    if (sorted.length >= 4 && gapConsistent) {
      confidence = "high";
    } else if (sorted.length >= 3 && gapConsistent) {
      confidence = "medium";
    } else {
      confidence = "low";
    }

    const lastSeenDate = sorted[sorted.length - 1].date;
    const nextExpectedDate = new Date(lastSeenDate);
    nextExpectedDate.setDate(nextExpectedDate.getDate() + Math.round(avgGap));

    candidates.push({
      merchant: sorted[sorted.length - 1].merchant.trim(),
      estimatedAmountCents,
      frequency: band.frequency,
      confidence,
      occurrenceCount: sorted.length,
      firstSeenDate: sorted[0].date,
      lastSeenDate,
      nextExpectedDate,
    });
  }

  return candidates.sort((a, b) => b.occurrenceCount - a.occurrenceCount);
}

/** Annualized cost estimate for a detected subscription — clearly a projection, never shown without this label upstream. */
export function calculateAnnualizedCostCents(estimatedAmountCents: number, frequency: RecurringFrequency): number {
  const occurrencesPerYear: Record<RecurringFrequency, number> = {
    weekly: 52,
    biweekly: 26,
    monthly: 12,
    quarterly: 4,
    yearly: 1,
  };
  return Math.round(estimatedAmountCents * occurrencesPerYear[frequency]);
}
