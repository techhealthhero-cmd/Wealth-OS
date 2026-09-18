/**
 * Debt Planner — deterministic payoff simulation. No LLM, no rate/behavior
 * predictions beyond what the user explicitly assumes stays constant
 * (current interest rates, current minimum payments). Every result here is
 * a projection under those fixed assumptions, not a promise — callers must
 * label it "estimate" in the UI (see task spec).
 */

export type DebtStrategy = "snowball" | "avalanche" | "custom";

export interface DebtInput {
  id: string;
  name: string;
  balanceCents: number;
  /** Annual rate as a plain percent, e.g. 18 = 18%/year. Null/0 treated as interest-free. */
  annualInterestRatePercent: number | null;
  minimumPaymentCents: number;
}

/**
 * Payoff order for a strategy. `customOrder` (liability ids, highest
 * priority first) is required for 'custom' and ignored otherwise.
 * Snowball = smallest balance first (fastest early wins). Avalanche =
 * highest interest rate first (minimizes total interest paid).
 */
export function calculatePayoffOrder(
  debts: DebtInput[],
  strategy: DebtStrategy,
  customOrder?: string[]
): string[] {
  if (strategy === "custom" && customOrder) {
    const known = new Set(debts.map((d) => d.id));
    const ordered = customOrder.filter((id) => known.has(id));
    const missing = debts.filter((d) => !ordered.includes(d.id)).map((d) => d.id);
    return [...ordered, ...missing];
  }

  const sorted = [...debts];
  if (strategy === "snowball") {
    sorted.sort((a, b) => a.balanceCents - b.balanceCents);
  } else {
    sorted.sort((a, b) => (b.annualInterestRatePercent ?? 0) - (a.annualInterestRatePercent ?? 0));
  }
  return sorted.map((d) => d.id);
}

export interface DebtPayoffSummary {
  id: string;
  payoffMonth: number | null; // null if it never pays off within maxMonths
  totalInterestPaidCents: number;
}

export interface DebtPayoffResult {
  order: string[];
  perLiability: DebtPayoffSummary[];
  /** Months until every debt reaches zero; null if any never pays off within maxMonths. */
  totalMonths: number | null;
  totalInterestPaidCents: number;
  /** vs. paying only minimums with no extra payment, same order. Never negative. */
  totalInterestSavedCents: number;
  monthlyDebtRequirementCents: number;
}

const DEFAULT_MAX_MONTHS = 600; // 50 years — a safe ceiling against runaway/never-payoff simulations

/**
 * Simulates monthly amortization: interest accrues on every active balance,
 * every debt gets at least its minimum payment (capped at its remaining
 * balance), then any extra payment (plus the minimum payments freed up by
 * already-paid-off debts, rolled forward — the actual "snowball/avalanche"
 * behavior, not just a flat extra on one debt forever) goes to the highest
 * -priority still-active debt in `order`.
 */
function simulatePayoff(
  debts: DebtInput[],
  order: string[],
  extraMonthlyPaymentCents: number,
  maxMonths: number = DEFAULT_MAX_MONTHS
): { payoffMonth: Map<string, number | null>; interestPaid: Map<string, number>; totalMonths: number | null } {
  const balances = new Map(order.map((id) => [id, debts.find((d) => d.id === id)!.balanceCents]));
  const monthlyRates = new Map(
    order.map((id) => {
      const d = debts.find((x) => x.id === id)!;
      return [id, (d.annualInterestRatePercent ?? 0) / 100 / 12];
    })
  );
  const minPayments = new Map(order.map((id) => [id, debts.find((d) => d.id === id)!.minimumPaymentCents]));
  // A debt that already has a zero (or negative) balance at the start — e.g.
  // a paid-off liability still on file — counts as paid off in month 0. The
  // loop below never revisits month 0, so this can't be derived from inside
  // it the way every other payoff month is.
  const payoffMonth = new Map<string, number | null>(order.map((id) => [id, balances.get(id)! <= 0 ? 0 : null]));
  const interestPaid = new Map<string, number>(order.map((id) => [id, 0]));

  let month = 0;
  let freedUpPoolCents = 0;
  // Same reasoning as payoffMonth above: if every debt starts at zero, the
  // while loop's guard is false immediately and never runs, so totalMonths
  // would otherwise stay null — which callers read as "never pays off",
  // the opposite of the truth.
  let totalMonths: number | null = order.every((id) => balances.get(id)! <= 0) ? 0 : null;

  while (order.some((id) => balances.get(id)! > 0) && month < maxMonths) {
    month++;

    for (const id of order) {
      const bal = balances.get(id)!;
      if (bal <= 0) continue;
      const interest = Math.round(bal * monthlyRates.get(id)!);
      balances.set(id, bal + interest);
      interestPaid.set(id, interestPaid.get(id)! + interest);
    }

    for (const id of order) {
      const bal = balances.get(id)!;
      if (bal <= 0) continue;
      const pay = Math.min(minPayments.get(id)!, bal);
      balances.set(id, bal - pay);
    }

    let extraAvailable = extraMonthlyPaymentCents + freedUpPoolCents;
    for (const id of order) {
      if (extraAvailable <= 0) break;
      const bal = balances.get(id)!;
      if (bal <= 0) continue;
      const pay = Math.min(extraAvailable, bal);
      balances.set(id, bal - pay);
      extraAvailable -= pay;
      break; // extra only ever targets the single highest-priority active debt
    }

    freedUpPoolCents = 0;
    for (const id of order) {
      const justPaidOff = balances.get(id)! <= 0 && payoffMonth.get(id) === null;
      if (justPaidOff) payoffMonth.set(id, month);
      if (balances.get(id)! <= 0) freedUpPoolCents += minPayments.get(id)!;
    }

    if (order.every((id) => balances.get(id)! <= 0)) {
      totalMonths = month;
    }
  }

  return { payoffMonth, interestPaid, totalMonths };
}

export function calculateDebtPayoffPlan(
  debts: DebtInput[],
  strategy: DebtStrategy,
  extraMonthlyPaymentCents: number,
  customOrder?: string[],
  maxMonths: number = DEFAULT_MAX_MONTHS
): DebtPayoffResult {
  const order = calculatePayoffOrder(debts, strategy, customOrder);
  const monthlyDebtRequirementCents =
    debts.reduce((sum, d) => sum + d.minimumPaymentCents, 0) + extraMonthlyPaymentCents;

  if (debts.length === 0) {
    return {
      order: [],
      perLiability: [],
      totalMonths: 0,
      totalInterestPaidCents: 0,
      totalInterestSavedCents: 0,
      monthlyDebtRequirementCents: 0,
    };
  }

  const withExtra = simulatePayoff(debts, order, extraMonthlyPaymentCents, maxMonths);
  const baseline = simulatePayoff(debts, order, 0, maxMonths);

  const totalInterestPaidCents = order.reduce((sum, id) => sum + withExtra.interestPaid.get(id)!, 0);
  const baselineInterestCents = order.reduce((sum, id) => sum + baseline.interestPaid.get(id)!, 0);

  return {
    order,
    perLiability: order.map((id) => ({
      id,
      payoffMonth: withExtra.payoffMonth.get(id) ?? null,
      totalInterestPaidCents: withExtra.interestPaid.get(id)!,
    })),
    totalMonths: withExtra.totalMonths,
    totalInterestPaidCents,
    totalInterestSavedCents: Math.max(0, baselineInterestCents - totalInterestPaidCents),
    monthlyDebtRequirementCents,
  };
}
