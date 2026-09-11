/**
 * Financial Forecast — deterministic month-by-month projection. Every
 * number is derived from a starting snapshot plus explicit, inspectable
 * assumptions (never an LLM guess). Allocations (savings/investment/debt
 * payment) are capped at whatever cash is actually available each month —
 * a forecast never manufactures money that isn't there.
 */

export interface ForecastStartingState {
  cashBalanceCents: number;
  monthlyIncomeCents: number;
  monthlyExpensesCents: number;
  netWorthCents: number;
  totalDebtCents: number;
}

export interface ForecastAssumptions {
  /** Percent per month, e.g. 0.5 = income grows 0.5% each month. */
  incomeGrowthRatePercent: number;
  expenseGrowthRatePercent: number;
  monthlySavingsCents: number;
  monthlyInvestmentCents: number;
  monthlyDebtPaymentCents: number;
  oneTimeIncomeCents: number;
  /** 1-indexed month within the horizon this applies to, or null for none. */
  oneTimeIncomeMonth: number | null;
  oneTimeExpenseCents: number;
  oneTimeExpenseMonth: number | null;
}

export interface ForecastMonthResult {
  month: number; // 1-indexed
  incomeCents: number;
  expensesCents: number;
  cashBalanceCents: number;
  cumulativeSavingsCents: number;
  cumulativeInvestmentCents: number;
  debtCents: number;
  netWorthCents: number;
}

export const ZERO_ASSUMPTIONS: ForecastAssumptions = {
  incomeGrowthRatePercent: 0,
  expenseGrowthRatePercent: 0,
  monthlySavingsCents: 0,
  monthlyInvestmentCents: 0,
  monthlyDebtPaymentCents: 0,
  oneTimeIncomeCents: 0,
  oneTimeIncomeMonth: null,
  oneTimeExpenseCents: 0,
  oneTimeExpenseMonth: null,
};

export function calculateForecast(
  starting: ForecastStartingState,
  assumptions: ForecastAssumptions,
  horizonMonths: number
): ForecastMonthResult[] {
  const results: ForecastMonthResult[] = [];

  // "Other" net worth not otherwise modeled here (property, manual assets,
  // ...) — held constant so the projected net worth stays anchored to the
  // real starting snapshot rather than silently discarding it.
  const otherNetWorthCents =
    starting.netWorthCents - starting.cashBalanceCents + starting.totalDebtCents;

  let income = starting.monthlyIncomeCents;
  let expenses = starting.monthlyExpensesCents;
  let cash = starting.cashBalanceCents;
  let debt = starting.totalDebtCents;
  let cumulativeSavings = 0;
  let cumulativeInvestment = 0;

  for (let month = 1; month <= horizonMonths; month++) {
    income = income * (1 + assumptions.incomeGrowthRatePercent / 100);
    expenses = expenses * (1 + assumptions.expenseGrowthRatePercent / 100);

    const oneTimeIncome = assumptions.oneTimeIncomeMonth === month ? assumptions.oneTimeIncomeCents : 0;
    const oneTimeExpense = assumptions.oneTimeExpenseMonth === month ? assumptions.oneTimeExpenseCents : 0;

    cash = cash + income - expenses + oneTimeIncome - oneTimeExpense;

    // Allocations never exceed available cash — a plan someone can't
    // actually afford that month simply doesn't fully execute, rather than
    // driving cash artificially negative.
    let available = Math.max(0, cash);
    const savingsApplied = Math.min(assumptions.monthlySavingsCents, available);
    available -= savingsApplied;
    const investmentApplied = Math.min(assumptions.monthlyInvestmentCents, available);
    available -= investmentApplied;
    const debtPaymentApplied = Math.min(assumptions.monthlyDebtPaymentCents, available, debt);

    cash -= savingsApplied + investmentApplied + debtPaymentApplied;
    cumulativeSavings += savingsApplied;
    cumulativeInvestment += investmentApplied;
    debt = Math.max(0, debt - debtPaymentApplied);

    const netWorth = otherNetWorthCents + cash + cumulativeSavings + cumulativeInvestment - debt;

    results.push({
      month,
      incomeCents: Math.round(income),
      expensesCents: Math.round(expenses),
      cashBalanceCents: Math.round(cash),
      cumulativeSavingsCents: Math.round(cumulativeSavings),
      cumulativeInvestmentCents: Math.round(cumulativeInvestment),
      debtCents: Math.round(debt),
      netWorthCents: Math.round(netWorth),
    });
  }

  return results;
}

/** Conservative preset: slower income growth, faster expense growth, reduced savings — a defensive "things go a bit worse" view. */
export function deriveConservativeAssumptions(base: ForecastAssumptions): ForecastAssumptions {
  return {
    ...base,
    incomeGrowthRatePercent: base.incomeGrowthRatePercent - 1,
    expenseGrowthRatePercent: base.expenseGrowthRatePercent + 1,
    monthlySavingsCents: Math.round(base.monthlySavingsCents * 0.8),
    monthlyInvestmentCents: Math.round(base.monthlyInvestmentCents * 0.8),
  };
}

/** Optimistic preset: faster income growth, slower expense growth, increased savings — an "things go a bit better" view. */
export function deriveOptimisticAssumptions(base: ForecastAssumptions): ForecastAssumptions {
  return {
    ...base,
    incomeGrowthRatePercent: base.incomeGrowthRatePercent + 1,
    expenseGrowthRatePercent: Math.max(0, base.expenseGrowthRatePercent - 1),
    monthlySavingsCents: Math.round(base.monthlySavingsCents * 1.2),
    monthlyInvestmentCents: Math.round(base.monthlyInvestmentCents * 1.2),
  };
}

// ---------------------------------------------------------------------------
// Scenario planning — deterministic "what if" deltas. Each returns a new,
// modified copy; never mutates its input. AI may explain these results in a
// later phase, but never computes them.
// ---------------------------------------------------------------------------

export function scenarioExtraMonthlySavings(
  assumptions: ForecastAssumptions,
  extraCents: number
): ForecastAssumptions {
  return { ...assumptions, monthlySavingsCents: assumptions.monthlySavingsCents + extraCents };
}

export function scenarioExtraDebtPayment(
  assumptions: ForecastAssumptions,
  extraCents: number
): ForecastAssumptions {
  return { ...assumptions, monthlyDebtPaymentCents: assumptions.monthlyDebtPaymentCents + extraCents };
}

export function scenarioIncomeChangePercent(
  starting: ForecastStartingState,
  percent: number
): ForecastStartingState {
  return { ...starting, monthlyIncomeCents: Math.round(starting.monthlyIncomeCents * (1 + percent / 100)) };
}

export function scenarioExpenseChangeCents(
  starting: ForecastStartingState,
  deltaCents: number
): ForecastStartingState {
  return { ...starting, monthlyExpensesCents: Math.max(0, starting.monthlyExpensesCents + deltaCents) };
}

export function scenarioOneTimeExpense(
  assumptions: ForecastAssumptions,
  amountCents: number,
  month: number
): ForecastAssumptions {
  return { ...assumptions, oneTimeExpenseCents: amountCents, oneTimeExpenseMonth: month };
}

export function scenarioLoseIncome(
  starting: ForecastStartingState,
  lostMonthlyIncomeCents: number
): ForecastStartingState {
  return {
    ...starting,
    monthlyIncomeCents: Math.max(0, starting.monthlyIncomeCents - lostMonthlyIncomeCents),
  };
}
