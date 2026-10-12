import { describe, expect, it } from "vitest";

import { parseCaptureText, type ParseContext } from "@/lib/capture/transaction-parser";
import { parseRecap } from "@/lib/capture/recap";
import { mergeCaptureUnits, toCaptureUnits } from "@/lib/capture/units";

const CTX: ParseContext = {
  today: "2026-10-13",
  accounts: [{ id: "cash", name: "Cash", account_type: "cash", institution: null, is_archived: false }],
  categories: [
    { id: "food", name_th: "อาหาร", name_en: "Food & Dining", type: "expense", icon: null, is_system: true },
    { id: "salary", name_th: "เงินเดือน", name_en: "Salary", type: "income", icon: null, is_system: true },
    { id: "other-in", name_th: "อื่นๆ", name_en: "Other", type: "income", icon: null, is_system: true },
    { id: "other-out", name_th: "อื่นๆ", name_en: "Other", type: "expense", icon: null, is_system: true },
  ],
  merchantPreferences: [],
};

const DRINK = { unit_normalized: "ดื่ม", unit_label: "ดื่ม", unit_price_cents: 20_000, type: "income" as const, category_id: "salary" };
const WITH_DRINK: ParseContext = { ...CTX, units: [DRINK] };

describe("counted units (reported 2026-10-13: “วันนี้ได้ 10 ดื่ม” was a ฿10 expense)", () => {
  it("an unpriced unit is a count, not baht: no amount, asked once", () => {
    const parsed = parseCaptureText("วันนี้ได้ 10 ดื่ม", CTX);
    expect(parsed).toMatchObject({ type: "income", amountCents: null, unknownUnit: { word: "ดื่ม", count: 10 }, unit: null });
    expect(parsed.missing).toContain("amount");
  });

  it("a saved unit becomes count × price, with its own type and category", () => {
    expect(parseCaptureText("วันนี้ได้ 10 ดื่ม", WITH_DRINK)).toMatchObject({
      type: "income",
      amountCents: 200_000,
      categoryId: "salary",
      categorySource: "learned",
      description: "10 ดื่ม",
      unit: { count: 10, label: "ดื่ม", unitPriceCents: 20_000 },
      unknownUnit: null,
    });
    // No "ได้" needed once the unit is known; glued words still match.
    expect(parseCaptureText("10ดื่มวันนี้", WITH_DRINK)).toMatchObject({ amountCents: 200_000 });
  });

  it("a price said right there wins for that entry", () => {
    expect(parseCaptureText("ได้ 10 ดื่ม ดื่มละ 250", WITH_DRINK)).toMatchObject({ amountCents: 250_000 });
    // …and prices an unknown unit without asking.
    expect(parseCaptureText("ได้ 8 เคส เคสละ 1,000 บาท", CTX)).toMatchObject({
      type: "income",
      amountCents: 800_000,
      unknownUnit: null,
      unit: { count: 8, label: "เคส", unitPriceCents: 100_000 },
    });
  });

  it("money words and real prices are never units", () => {
    expect(parseCaptureText("ได้ 2 พัน", CTX)).toMatchObject({ amountCents: 200_000, unknownUnit: null });
    expect(parseCaptureText("ได้ 500 บาท", CTX)).toMatchObject({ amountCents: 50_000, unknownUnit: null });
    // A quantity with its price: the price is the amount.
    expect(parseCaptureText("ขายได้ 2 ชิ้น 300", CTX)).toMatchObject({ amountCents: 30_000, unknownUnit: null });
    // Without ได้ an unknown word after a number stays as before.
    expect(parseCaptureText("ข้าว 50", CTX)).toMatchObject({ type: "expense", amountCents: 5_000, unknownUnit: null });
  });

  it("a per-unit income source from Earn prices its word too; a saved unit wins", () => {
    const units = mergeCaptureUnits([], [{ unit_label: " ดื่ม ", unit_rate: "200.00" }], "salary");
    expect(units).toEqual([{ unit_normalized: "ดื่ม", unit_label: "ดื่ม", unit_price_cents: 20_000, type: "income", category_id: "salary" }]);
    expect(parseCaptureText("ได้ 10 ดื่ม", { ...CTX, units })).toMatchObject({ amountCents: 200_000, categoryId: "salary" });
    const saved = toCaptureUnits([{ unit_normalized: "ดื่ม", unit_label: "ดื่ม", unit_price: "250.00", type: "income", category_id: null }]);
    expect(mergeCaptureUnits(saved, [{ unit_label: "ดื่ม", unit_rate: "200" }], "salary")).toHaveLength(1);
    expect(mergeCaptureUnits(saved, [{ unit_label: "ดื่ม", unit_rate: "200" }], "salary")[0].unit_price_cents).toBe(25_000);
    // An unreadable price is skipped, never guessed.
    expect(toCaptureUnits([{ unit_normalized: "x", unit_label: "x", unit_price: "abc", type: "income", category_id: null }])).toEqual([]);
  });

  it("splits a recap after the unit word, not after the count", () => {
    const items = parseRecap("วันนี้ได้ 10 ดื่ม ข้าว 50 กาแฟ 40", WITH_DRINK);
    expect(items.map((i) => [i.type, i.amountCents])).toEqual([
      ["income", 200_000],
      ["expense", 5_000],
      ["expense", 4_000],
    ]);
    // An unpriced unit in a recap is still one item, waiting for its price.
    const unknown = parseRecap("ได้ 10 ดื่ม ข้าว 50", CTX);
    expect(unknown.map((i) => [i.amountCents, i.unknownUnit?.word ?? null])).toEqual([
      [null, "ดื่ม"],
      [5_000, null],
    ]);
    // "ได้ 500 ข้าว 50" is two priced items, not 500 units of rice.
    expect(parseRecap("ขายของได้ 500 ข้าว 50", CTX).map((i) => i.amountCents)).toEqual([50_000, 5_000]);
    // A per-unit price after the count stays with it.
    expect(parseRecap("ได้ 10 ดื่ม ดื่มละ 250 ข้าว 50", WITH_DRINK).map((i) => i.amountCents)).toEqual([250_000, 5_000]);
  });
});
