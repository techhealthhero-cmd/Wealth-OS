import { describe, expect, it } from "vitest";
import { splitInstallment } from "@/lib/financial/amortization";
import { calculateNetWorth } from "@/lib/financial/net-worth";

describe("installment principal in cents", () => {
  it.each([
    [2000000, 12, 200000, 180000, 20000, 1820000],
    [100, 6, 10, 9, 1, 91], // half a cent rounds up
    [100, 0, 200, 100, 0, 0],
    [2000000, 12, 10000, 0, 20000, 2000000],
    [0, 12, 100, 0, 0, 0],
  ])("splits balance %s at %s%% with payment %s", (balanceCents, annualRatePct, paymentCents, principalCents, interestCents, balance) => {
    expect(splitInstallment({ balanceCents, annualRatePct, paymentCents })).toEqual({ principalCents, interestCents, balanceCents: balance });
  });
  it.each([-1, 1.5, NaN, Infinity])("rejects invalid cents %s", (balanceCents) => {
    expect(() => splitInstallment({ balanceCents, annualRatePct: 0, paymentCents: 1 })).toThrow();
  });
  it.each([-1, NaN, Infinity])("rejects invalid annual rate %s", (annualRatePct) => {
    expect(() => splitInstallment({ balanceCents: 100, annualRatePct, paymentCents: 10 })).toThrow();
  });
  it("borrowing 20,000 preserves net worth; repayment costs only interest", () => {
    const account = (balanceCents: number) => ({ balanceCents, includeInNetWorth: true });
    const debt = { balanceCents: 2000000, includeInNetWorth: true, linkedAccountId: "ledger" };
    expect(calculateNetWorth([account(2000000), account(-2000000)], [], [debt]).netWorthCents).toBe(0);
    const split = splitInstallment({ balanceCents: debt.balanceCents, annualRatePct: 12, paymentCents: 200000 });
    expect(calculateNetWorth([account(1800000), account(-2000000 + split.principalCents)], [], [{ ...debt, balanceCents: split.balanceCents }]).netWorthCents).toBe(-split.interestCents);
    expect(calculateNetWorth([account(1800000)], [], [{ ...debt, linkedAccountId: null, balanceCents: split.balanceCents }]).netWorthCents).toBe(-split.interestCents);
  });
});
