import { describe, it, expect } from "vitest";
import { ASSET_TYPES } from "@/lib/validation/asset";
import { ASSET_GROUPS, classifyAssetName, groupForAssetType } from "@/lib/financial/asset-taxonomy";
import { estimateAssetValue, projectAssetValues } from "@/lib/financial/asset-value";
const start = new Date("2020-01-01T00:00:00Z");
function value(group: string, subcategory: string, years: number, extra = {}) {
  return estimateAssetValue({ purchasePriceCents: 4_000_000, purchaseDate: start, asOf: new Date(+start + years * 365.25 * 86400000), group, subcategory, ...extra });
}
describe("asset estimates", () => {
  it.each([[1, 3000000], [2, 2250000], [3, 1687500]])("laptop after %s years", (years, cents) => expect(value("it_electronics", "laptop", years).estimatedValueCents).toBe(cents));
  it("phone uses 40% first year then 20%", () => {
    expect(value("it_electronics", "phone", 1).estimatedValueCents).toBe(2400000);
    expect(value("it_electronics", "phone", 2).estimatedValueCents).toBe(1920000);
  });
  it("car uses 20% then 12%", () => expect(value("land_vehicles", "car", 2).estimatedValueCents).toBe(2816000));
  it("applies 5% IT and 10% ordinary floors", () => {
    expect(value("it_electronics", "laptop", 50)).toMatchObject({ estimatedValueCents: 200000, floorApplied: true });
    expect(value("home_appliances", "furniture", 50)).toMatchObject({ estimatedValueCents: 400000, floorApplied: true });
  });
  it("gold fallback compounds 9%, signals market price needed", () => expect(value("precious_metals", "gold", 2)).toMatchObject({ estimatedValueCents: 4752400, needsMarketPrice: true, source: "default", isEstimate: true }));
  it.each([["precious_metals", "gold"], ["digital_assets", "bitcoin"], ["market_investments", "funds"]])("prefers supplied market for %s", (g, s) => expect(value(g, s, 10, { marketValueCents: 123456 })).toMatchObject({ estimatedValueCents: 123456, yearlyChangeCents: 0, source: "market", needsMarketPrice: false }));
  it("Bitcoin never projects a default rate", () => expect(value("digital_assets", "bitcoin", 10)).toMatchObject({ estimatedValueCents: 4000000, annualRatePct: null, yearlyChangeCents: 0, needsMarketPrice: true, source: "none" }));
  it("10% override replaces both phone rates", () => expect(value("it_electronics", "phone", 2, { overrideRatePct: 10 })).toMatchObject({ estimatedValueCents: 3240000, source: "override" }));
  it("negative override appreciates and has no floor", () => expect(value("it_electronics", "phone", 2, { overrideRatePct: -10 })).toMatchObject({ estimatedValueCents: 4840000, floorCents: 0, mode: "compound" }));
  it("uses fractional years, upcoming 12-month change and integer satang", () => {
    const result = value("it_electronics", "laptop", .5);
    expect(result.yearsHeld).toBe(.5);
    expect(result.estimatedValueCents).toBe(Math.round(4000000 * Math.sqrt(.75)));
    expect(result.yearlyChangeCents).toBe(value("it_electronics", "laptop", 1.5).estimatedValueCents - result.estimatedValueCents);
  });
  it("projections include year zero and retain a spot quote", () => {
    const points = projectAssetValues({ purchasePriceCents: 100000, purchaseDate: start, asOf: start, group: "it_electronics", subcategory: "laptop" }, 3);
    expect(points.map((p) => p.estimatedValueCents)).toEqual([100000, 75000, 56250, 42188]);
  });
  it("rejects invalid inputs", () => {
    expect(() => value("custom", "", 1, { purchasePriceCents: -1 })).toThrow();
    expect(() => value("custom", "", 1, { asOf: "bad" })).toThrow();
    expect(() => value("custom", "", 1, { floorPct: 101 })).toThrow();
  });
});
describe("taxonomy", () => {
  it("contains all 26 unique L5 groups and valid legacy types", () => {
    expect(ASSET_GROUPS).toHaveLength(26);
    expect(new Set(ASSET_GROUPS.map((g) => g.key)).size).toBe(26);
    for (const g of ASSET_GROUPS) { expect(ASSET_TYPES).toContain(g.assetType); expect(g.labelTh && g.labelEn && g.emoji).toBeTruthy(); }
    for (const t of ASSET_TYPES) expect(ASSET_GROUPS.some((g) => g.key === groupForAssetType(t))).toBe(true);
  });
  it.each([
    ["คอมใหม่", "computer"], ["MacBook Pro", "laptop"], ["iPhone 17", "phone"], ["โทรศัพท์", "phone"], ["iPad", "tablet"], ["AirPods", "headphones"], ["หูฟัง", "headphones"], ["เครื่องพิมพ์", "printer"], ["Honda Click", "motorcycle"], ["มอไซค์", "motorcycle"], ["รถยนต์", "car"], ["รถมือสอง", "used_car"], ["บ้าน", "house"], ["คอนโด", "condo"], ["ที่ดิน", "land"], ["ทองคำ", "gold"], ["Bitcoin", "bitcoin"], ["Rolex", "luxury_watch"], ["Hermès Birkin", "hermes"], ["Chanel Classic Flap", "chanel_classic"], ["เพชร", "diamond"], ["กล้อง Canon", "camera"], ["เลนส์", "lens"], ["กีตาร์", "instrument"], ["จักรยาน", "bicycle"], ["โซฟา", "furniture"], ["ตู้เย็น", "appliance"], ["โดรน DJI", "drone"], ["เรือ", "boat"], ["รถขุด", "excavator"], ["รถแทรกเตอร์", "tractor"], ["สว่าน Makita", "power_tools"], ["วัว", "livestock"], ["พระเครื่อง", "amulet"], ["ภาพวาด", "art"], ["ไม้กอล์ฟ", "golf"], ["ปืนพก", "firearm"], ["กองทุน RMF", "funds"],
  ])("classifies %s", (name, subcategory) => expect(classifyAssetName(name)?.subcategory).toBe(subcategory));
  it.each(["กินข้าว", "เสื้อ", "กล้วย", "scarf", "carpet"])('does not classify %s', (name) => expect(classifyAssetName(name)).toBeNull());
});
