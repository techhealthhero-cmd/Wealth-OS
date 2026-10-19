import { describe, expect, it } from "vitest";
import { annualize, estimateYearEndTax, progressiveTax } from "@/lib/financial/thai-tax-estimate";

const zero = { income402YtdCents: 0, income408YtdCents: 0, monthsElapsed: 12, withholdingYtdCents: 0 };

describe("Thai tax estimate", () => {
  it("matches the worked example (all hand calculations below in THB)", () => {
    // Annual 402 = 300,000 * 12/10 = 360,000; 408 = 240,000.
    // Expenses = min(180,000, 100,000) + 144,000 = 244,000.
    // Net = 600,000 - 244,000 - 60,000 = 296,000.
    // Progressive = (296,000 - 150,000) * 5% = 7,300.
    // Minimum = 600,000 * 0.5% = 3,000, ignored (<= 5,000).
    // WHT = 9,000 * 12/10 = 10,800; due = 7,300 - 10,800 = -3,500.
    const result = estimateYearEndTax({ income402YtdCents: 300000_00, income408YtdCents: 200000_00, monthsElapsed: 10, withholdingYtdCents: 9000_00 });
    expect(result).toMatchObject({ annual402: 360000_00, annual408: 240000_00, expense402: 100000_00, expense408: 144000_00, netIncome: 296000_00, progressiveTaxCents: 7300_00, minimumTaxCents: 3000_00, taxCents: 7300_00, annualWithholdingCents: 10800_00, estimatedDueCents: -3500_00 });
    expect(result.breakdown.reduce((sum, band) => sum + band.taxCents, 0)).toBe(7300_00);
  });
  it("returns zero tax for zero income", () => {
    expect(estimateYearEndTax(zero)).toMatchObject({ netIncome: 0, taxCents: 0, minimumTaxCents: 0, estimatedDueCents: 0 });
  });
  it("uses the minimum tax only above its exemption", () => {
    // 1,200,000 gross * 0.5% = 6,000; 100% expenses make progressive zero.
    expect(estimateYearEndTax({ ...zero, income408YtdCents: 1200000_00, expense408RatePct: 100 })).toMatchObject({ progressiveTaxCents: 0, minimumTaxCents: 6000_00, taxCents: 6000_00 });
    expect(estimateYearEndTax({ ...zero, income408YtdCents: 1000000_00, expense408RatePct: 100 })).toMatchObject({ minimumTaxCents: 5000_00, taxCents: 0 });
    expect(estimateYearEndTax({ ...zero, income402YtdCents: 119999_00 }).minimumTaxCents).toBe(0);
    expect(estimateYearEndTax({ ...zero, income402YtdCents: 120000_00 }).minimumTaxCents).toBe(600_00);
  });
  it("allows extra deductions and configurable expense rates", () => {
    expect(estimateYearEndTax({ ...zero, income402YtdCents: 100000_00 }).expense402).toBe(50000_00);
    expect(estimateYearEndTax({ ...zero, income408YtdCents: 600000_00, expense408RatePct: 50, extraDeductionsCents: 100000_00 })).toMatchObject({ expense408: 300000_00, netIncome: 140000_00, taxCents: 0 });
  });
  it.each([[150000, 0], [300000, 7500], [500000, 27500], [750000, 65000], [1000000, 115000], [2000000, 365000], [5000000, 1265000], [6000000, 1615000]])("taxes net THB %s progressively", (net, tax) => {
    expect(progressiveTax(net * 100)).toBe(tax * 100);
  });
  it("rounds annualization and marginal tax half-up", () => {
    expect(annualize(1, 8)).toBe(2);
    expect(annualize(123, 12)).toBe(123);
    expect(progressiveTax(150000_00 + 10)).toBe(1);
  });
  it.each([0, 13, 1.5, NaN, Infinity])("rejects monthsElapsed %s", monthsElapsed => {
    expect(() => annualize(100, monthsElapsed)).toThrow();
    expect(() => estimateYearEndTax({ ...zero, monthsElapsed })).toThrow();
  });
  it.each([-1, NaN, Infinity, 1.5])("rejects invalid monetary input %s", value => {
    expect(() => annualize(value, 12)).toThrow();
    expect(() => progressiveTax(value)).toThrow();
  });
  it.each([-1, 101, NaN, Infinity])("rejects expense rate %s", expense408RatePct => {
    expect(() => estimateYearEndTax({ ...zero, expense408RatePct })).toThrow();
  });
});
