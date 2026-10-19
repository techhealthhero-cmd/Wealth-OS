import { daysBetween, daysInMonth, dedupeOccurrences, firstUnpaidDate, projectDueDates, type PaymentOccurrence, type PaymentSource } from "./payment-calendar";
import { calendarDateSchema } from "@/lib/validation/invoices-tax-jar";

export const SAFE_TO_SPEND_TODAY_FORMULA_STATUS = "approved" as const;

export interface SafeToSpendTodayInput {
  today: string;
  liquidAccounts: { id: string; balanceCents: number }[];
  excludedAccountIds: string[];
  paymentSources: PaymentSource[];
  nextIncomeDate: string | null;
  taxJar: { targetCents: number; balanceCents: number } | null;
  emergencyFund: { targetCents: number; currentCents: number; monthlyContributionCents: number } | null;
}

function cents(value: number): number {
  if (!Number.isSafeInteger(value)) throw new Error("Expected safe integer satang");
  return value;
}

/**
 * Formula approved by the user on 2026-10-19. Pure integer-satang calculation with explicit
 * local calendar dates. Unpaid invoices (receivables) are deliberately excluded:
 * they are not received cash and are not an input.
 */
export function computeSafeToSpendToday(input: SafeToSpendTodayInput) {
  const { today, liquidAccounts, excludedAccountIds, paymentSources, nextIncomeDate, taxJar, emergencyFund } = input;
  calendarDateSchema.parse(today);
  if (nextIncomeDate) calendarDateSchema.parse(nextIncomeDate);
  for (const a of liquidAccounts) cents(a.balanceCents);
  for (const s of paymentSources) {
    cents(s.amountCents);
    for (const p of s.paid) cents(p.amountCents);
  }
  if (taxJar) { cents(taxJar.targetCents); cents(taxJar.balanceCents); }
  if (emergencyFund) { cents(emergencyFund.targetCents); cents(emergencyFund.currentCents); cents(emergencyFund.monthlyContributionCents); }

  const month = today.slice(0, 7);
  const monthEnd = `${month}-${daysInMonth(month)}`;
  let horizonEnd = monthEnd;
  let horizonReason: "next_income" | "month_end" = "month_end";
  if (nextIncomeDate && nextIncomeDate > today) {
    const prior = new Date(`${nextIncomeDate}T00:00:00Z`);
    prior.setUTCDate(prior.getUTCDate() - 1);
    const incomeEnd = prior.toISOString().slice(0, 10);
    if (incomeEnd <= monthEnd) { horizonEnd = incomeEnd; horizonReason = "next_income"; }
  }
  const daysLeft = Math.max(1, daysBetween(today, horizonEnd) + 1);
  const excluded = new Set(excludedAccountIds);
  let liquidCents = 0;
  let excludedEarmarkedCents = 0;
  for (const a of liquidAccounts) {
    if (excluded.has(a.id)) excludedEarmarkedCents = cents(excludedEarmarkedCents + a.balanceCents);
    else liquidCents = cents(liquidCents + a.balanceCents);
  }
  const occurrences: PaymentOccurrence[] = paymentSources.flatMap(s => {
    const paid = s.paid.map(p => ({ key: `${s.id}:${p.date}`, sourceId: s.id, label: s.label, kind: s.kind, ...p, paid: true }));
    const first = firstUnpaidDate(s);
    const paidDates = new Set(s.paid.map(p => p.date));
    const unpaid = first ? projectDueDates(first, s.frequency, s.endDate, first, horizonEnd)
      .filter(date => !paidDates.has(date))
      .map(date => ({ key: `${s.id}:${date}`, sourceId: s.id, label: s.label, kind: s.kind, amountCents: s.amountCents, date, paid: false })) : [];
    return [...paid, ...unpaid];
  });
  const bills = dedupeOccurrences(occurrences).filter(o => !o.paid)
    .sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
  const billsCents = bills.reduce((sum, b) => cents(sum + b.amountCents), 0);
  const taxJarShortfallCents = taxJar ? Math.max(0, cents(taxJar.targetCents - taxJar.balanceCents)) : 0;
  const emergencyTopUpCents = emergencyFund && emergencyFund.monthlyContributionCents > 0
    ? Math.min(emergencyFund.monthlyContributionCents, Math.max(0, cents(emergencyFund.targetCents - emergencyFund.currentCents))) : 0;
  const totalCents = cents(cents(cents(liquidCents - billsCents) - taxJarShortfallCents) - emergencyTopUpCents);
  return {
    totalCents, perDayCents: totalCents > 0 ? Math.floor(totalCents / daysLeft) : 0,
    daysLeft, horizonEnd, horizonReason, isShort: totalCents < 0,
    breakdown: { liquidCents, excludedEarmarkedCents, billsCents, bills, taxJarShortfallCents, emergencyTopUpCents },
  };
}
