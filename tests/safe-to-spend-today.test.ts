import { describe, expect, it } from "vitest";
import { computeSafeToSpendToday, type SafeToSpendTodayInput } from "@/lib/financial/safe-to-spend-today";
import type { PaymentSource } from "@/lib/financial/payment-calendar";
const base: SafeToSpendTodayInput = { today: "2026-10-20", liquidAccounts: [{ id: "cash", balanceCents: 12000 }], excludedAccountIds: [], paymentSources: [], nextIncomeDate: null, taxJar: null, emergencyFund: null };
const bill = (patch: Partial<PaymentSource> = {}): PaymentSource => ({ id: "bill", label: "Rent", kind: "expense", amountCents: 1000, frequency: null, nextDueDate: "2026-10-21", endDate: null, active: true, paid: [], ...patch });
const compute = (patch: Partial<SafeToSpendTodayInput> = {}) => computeSafeToSpendToday({ ...base, ...patch });
describe("safe to spend today (pending approval)", () => {
  it("calculates total and floors daily allowance", () => {
    expect(compute({ paymentSources: [bill()] })).toMatchObject({ totalCents: 11000, perDayCents: 916, daysLeft: 12, horizonEnd: "2026-10-31", horizonReason: "month_end" });
  });
  it.each([
    ["2026-10-25", "2026-10-24", 5, "next_income"],
    ["2026-10-21", "2026-10-20", 1, "next_income"],
    ["2026-11-10", "2026-10-31", 12, "month_end"],
    ["2026-10-20", "2026-10-31", 12, "month_end"],
    ["2026-10-01", "2026-10-31", 12, "month_end"],
  ])("income %s gives horizon %s", (nextIncomeDate, horizonEnd, daysLeft, horizonReason) => {
    expect(compute({ nextIncomeDate })).toMatchObject({ horizonEnd, daysLeft, horizonReason });
  });
  it("counts overdue unpaid bills", () => {
    expect(compute({ paymentSources: [bill({ nextDueDate: "2026-09-10" })] }).breakdown.billsCents).toBe(1000);
  });
  it("excludes paid, inactive and beyond-horizon occurrences", () => {
    const result = compute({ paymentSources: [bill({ paid: [{ date: "2026-10-21", amountCents: 1000 }] }), bill({ id: "inactive", active: false }), bill({ id: "future", nextDueDate: "2026-11-01" })] });
    expect(result.breakdown.bills).toEqual([]);
  });
  it("enumerates weekly bills and skips later verified paid dates", () => {
    const result = compute({ paymentSources: [bill({ frequency: "weekly", nextDueDate: "2026-10-07", paid: [{ date: "2026-10-21", amountCents: 1000 }] })] });
    expect(result.breakdown.bills.map(b => b.date)).toEqual(["2026-10-07", "2026-10-14", "2026-10-28"]);
    expect(result.breakdown.billsCents).toBe(3000);
  });
  it("drops an unpaid liability mirroring a paid recurring item, even inactive", () => {
    expect(compute({ paymentSources: [bill({ active: false, paid: [{ date: "2026-10-21", amountCents: 1000 }] }), bill({ id: "liability", kind: "liability" })] }).breakdown.bills).toEqual([]);
  });
  it("deduplicates unpaid mirrors and sorts by date then label", () => {
    const result = compute({ paymentSources: [bill({ id: "liability", kind: "liability" }), bill(), bill({ id: "a", label: "Apple" })] });
    expect(result.breakdown.bills.map(b => b.sourceId)).toEqual(["a", "bill"]);
  });
  it("excludes earmarked accounts once", () => {
    expect(compute({ excludedAccountIds: ["jar", "jar"], liquidAccounts: [...base.liquidAccounts, { id: "jar", balanceCents: 5000 }] }).breakdown).toMatchObject({ liquidCents: 12000, excludedEarmarkedCents: 5000 });
  });
  it.each([[null, 0], [{ targetCents: 2000, balanceCents: 500 }, 1500], [{ targetCents: 2000, balanceCents: 3000 }, 0]])("reserves only tax shortfall %j", (taxJar, expected) => {
    expect(compute({ taxJar }).breakdown.taxJarShortfallCents).toBe(expected);
  });
  it.each([[5000, 1000, 2000, 2000], [5000, 4500, 2000, 500], [5000, 6000, 2000, 0], [5000, 1000, 0, 0]])("caps emergency contribution", (targetCents, currentCents, monthlyContributionCents, expected) => {
    expect(compute({ emergencyFund: { targetCents, currentCents, monthlyContributionCents } }).breakdown.emergencyTopUpCents).toBe(expected);
  });
  it("subtracts all reserves and bills", () => {
    expect(compute({ paymentSources: [bill()], taxJar: { targetCents: 2000, balanceCents: 1000 }, emergencyFund: { targetCents: 5000, currentCents: 0, monthlyContributionCents: 2000 } }).totalCents).toBe(8000);
  });
  it("exposes a shortfall with zero daily allowance", () => {
    expect(compute({ paymentSources: [bill({ amountCents: 15000 })] })).toMatchObject({ totalCents: -3000, perDayCents: 0, isShort: true });
  });
  it.each([1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects invalid satang %s", balanceCents => {
    expect(() => compute({ liquidAccounts: [{ id: "cash", balanceCents }] })).toThrow("safe integer satang");
    expect(() => compute({ paymentSources: [bill({ amountCents: balanceCents })] })).toThrow();
    expect(() => compute({ taxJar: { targetCents: balanceCents, balanceCents: 0 } })).toThrow();
    expect(() => compute({ emergencyFund: { targetCents: 0, currentCents: 0, monthlyContributionCents: balanceCents } })).toThrow();
  });
});
