export interface IncomePlanAssumptions {
  ratePerUnitCents: number;
  unitsPerWeek: number;
  hoursPerUnit: number;
  activeWeeksPerYear: number;
}

export interface IncomePlanProjection {
  weeklyIncomeCents: number;
  monthlyIncomeCents: number;
  yearlyIncomeCents: number;
  weeklyHours: number;
  monthlyHours: number;
  yearlyHours: number;
  effectiveHourlyCents: number;
}

export function calculateIncomePlan(input: IncomePlanAssumptions): IncomePlanProjection {
  const rate = Math.max(0, Math.round(input.ratePerUnitCents));
  const units = Math.max(0, input.unitsPerWeek);
  const hoursPerUnit = Math.max(0, input.hoursPerUnit);
  const activeWeeks = Math.min(52, Math.max(0, input.activeWeeksPerYear));
  const weeklyIncomeCents = Math.round(rate * units);
  const yearlyIncomeCents = Math.round(weeklyIncomeCents * activeWeeks);
  const monthlyIncomeCents = Math.round(yearlyIncomeCents / 12);
  const weeklyHours = units * hoursPerUnit;
  const yearlyHours = weeklyHours * activeWeeks;
  const monthlyHours = yearlyHours / 12;
  const effectiveHourlyCents = yearlyHours > 0 ? Math.round(yearlyIncomeCents / yearlyHours) : 0;

  return {
    weeklyIncomeCents,
    monthlyIncomeCents,
    yearlyIncomeCents,
    weeklyHours,
    monthlyHours,
    yearlyHours,
    effectiveHourlyCents,
  };
}

export function calculateGrowthProjection(
  input: IncomePlanAssumptions,
  focus: "steady" | "more_clients" | "raise_rate" | "scale"
): IncomePlanProjection {
  const factors = {
    steady: { rate: 1, units: 1 },
    more_clients: { rate: 1, units: 1.5 },
    raise_rate: { rate: 1.2, units: 1 },
    scale: { rate: 1.25, units: 2 },
  }[focus];

  return calculateIncomePlan({
    ...input,
    ratePerUnitCents: Math.round(input.ratePerUnitCents * factors.rate),
    unitsPerWeek: input.unitsPerWeek * factors.units,
  });
}
