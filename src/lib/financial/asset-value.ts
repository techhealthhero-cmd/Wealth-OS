import { getAssetRule, type ValuationRule, type ValuationMode } from "./asset-taxonomy";

export interface AssetValueInput {
  purchasePriceCents: number;
  purchaseDate: string | Date;
  asOf: string | Date;
  group?: string;
  subcategory?: string;
  rule?: ValuationRule;
  /** Positive = depreciation, negative = appreciation, matching the proposal column. */
  overrideRatePct?: number;
  marketValueCents?: number;
  floorPct?: number;
}
export interface AssetValueEstimate {
  estimatedValueCents: number; yearsHeld: number; annualRatePct: number | null;
  yearlyChangeCents: number; floorCents: number; floorApplied: boolean;
  mode: ValuationMode; source: "market" | "override" | "default" | "none";
  needsMarketPrice: boolean; isEstimate: true;
}
const dateMs = (d: string | Date) => d instanceof Date ? d.getTime() : new Date(d.length === 10 ? `${d}T00:00:00Z` : d).getTime();
const cents = (n: number) => Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.round(n)));
/** Existing rows can use assets.value + created_at as an explicit approximation
 * until purchase metadata is available. Never silently treat it as historical cost.
 */
export function estimateAssetValue(input: AssetValueInput): AssetValueEstimate {
  const { purchasePriceCents: price, overrideRatePct: override, marketValueCents: market } = input;
  if (!Number.isSafeInteger(price) || price < 0 || (market !== undefined && (!Number.isSafeInteger(market) || market < 0))) throw new RangeError("Invalid money");
  const elapsed = dateMs(input.asOf) - dateMs(input.purchaseDate);
  if (!Number.isFinite(elapsed) || (override !== undefined && !Number.isFinite(override))) throw new RangeError("Invalid date or rate");
  const yearsHeld = Math.max(0, elapsed / (365.25 * 86400000));
  const rule = input.rule ?? getAssetRule(input.group ?? "custom", input.subcategory);
  const mode: ValuationMode = override !== undefined ? override < 0 ? "compound" : "declining" : rule.mode;
  const floorPct = input.floorPct ?? rule.floorPct ?? 10;
  if (!Number.isFinite(floorPct) || floorPct < 0 || floorPct > 100) throw new RangeError("Invalid floor");
  const floorCents = mode === "declining" ? cents(price * floorPct / 100) : 0;
  const rate = override !== undefined ? Math.abs(override) : rule.annualRatePct ?? rule.marketFallbackRatePct;
  const first = override !== undefined ? rate : rule.firstYearRatePct ?? rate;
  const fallback = mode === "market" && rule.marketFallbackRatePct !== undefined;
  const valueAt = (years: number) => {
    if (mode === "fixed" || (mode === "market" && !fallback)) return price;
    if (mode === "compound" || fallback) return price * (1 + (rate ?? 0) / 100) ** years;
    return price * Math.max(0, 1 - (first ?? 0) / 100) ** Math.min(years, 1) * Math.max(0, 1 - (rate ?? 0) / 100) ** Math.max(years - 1, 0);
  };
  const raw = valueAt(yearsHeld);
  const value = market ?? cents(Math.max(floorCents, raw));
  // A spot quote supplies no forecast, including when the rule has a fallback.
  const next = market !== undefined ? market : cents(Math.max(floorCents, valueAt(yearsHeld + 1)));
  return {
    estimatedValueCents: value, yearsHeld, annualRatePct: market !== undefined ? null : mode === "declining" && yearsHeld < 1 ? first ?? null : rate ?? null,
    yearlyChangeCents: next - value, floorCents, floorApplied: market === undefined && mode === "declining" && raw <= floorCents,
    mode, source: market !== undefined ? "market" : override !== undefined ? "override" : rate !== undefined || mode === "fixed" ? "default" : "none",
    needsMarketPrice: market === undefined && rule.mode === "market" && override === undefined, isEstimate: true,
  };
}
/** Points include today and each following 365.25-day year. A supplied market quote stays flat. */
export function projectAssetValues(input: AssetValueInput, years: number): (AssetValueEstimate & { year: number })[] {
  if (!Number.isInteger(years) || years < 0 || years > 200) throw new RangeError("Invalid projection horizon");
  return Array.from({ length: years + 1 }, (_, year) => ({ ...estimateAssetValue({ ...input, asOf: new Date(dateMs(input.asOf) + year * 365.25 * 86400000) }), year }));
}
