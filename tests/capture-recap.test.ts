import { describe, expect, it } from "vitest";

import { isMultiItemRecap, parseRecap, recapTotals, splitRecap } from "@/lib/capture/recap";
import { extractAmount, parseCaptureText, type ParseContext } from "@/lib/capture/transaction-parser";

const SYS = (id: string, name_th: string, name_en: string, type: "expense" | "income") => ({
  id,
  name_th,
  name_en,
  type,
  icon: null,
  is_system: true,
});

const CTX: ParseContext = {
  today: "2026-10-02",
  accounts: [
    { id: "acc-cash", name: "เงินสด", account_type: "cash", institution: null, is_archived: false },
    { id: "acc-kbank", name: "KBank", account_type: "bank", institution: "Kasikorn", is_archived: false },
  ],
  categories: [
    SYS("cat-food", "อาหาร", "Food & Dining", "expense"),
    SYS("cat-transport", "เดินทาง", "Transport", "expense"),
    SYS("cat-family", "ครอบครัว", "Family", "expense"),
    SYS("cat-other", "อื่นๆ", "Other", "expense"),
    SYS("cat-salary", "เงินเดือน", "Salary", "income"),
    SYS("cat-gift", "ของขวัญ", "Gift", "income"),
    SYS("cat-other-in", "อื่นๆ", "Other", "income"),
  ],
  merchantPreferences: [],
};

const EVENING_RECAP = "วันนี้ใช้อะไรไปบ้าง กินข้าว 40 บาท น้ำ 10 บาท ขนม 50 วินมอไซต์ 40 ไปกลับ 80 วันนี้เงินเดือนออก 20,000 แม่ให้ 2,000";

describe("splitRecap", () => {
  it("splits the evening recap at each amount and merges 'ไปกลับ' into the ride", () => {
    expect(splitRecap(EVENING_RECAP)).toEqual([
      "กินข้าว 40 บาท",
      "น้ำ 10 บาท",
      "ขนม 50",
      "วินมอไซต์ ไปกลับ 80",
      "วันนี้เงินเดือนออก 20,000",
      "แม่ให้ 2,000",
    ]);
  });

  it("does not split on quantities, brand digits, dates or clock times", () => {
    expect(splitRecap("ข้าว 2 จาน 120")).toEqual(["ข้าว 2 จาน 120"]);
    expect(splitRecap("7-11 55 กาแฟ 45")).toEqual(["7-11 55", "กาแฟ 45"]);
    expect(splitRecap("วันที่ 15 ค่าห้อง 4500")).toEqual(["วันที่ 15 ค่าห้อง 4500"]);
    expect(splitRecap("8 โมง กาแฟ 60 บ่าย 3 ขนม 35")).toEqual(["8 โมง กาแฟ 60", "บ่าย 3 ขนม 35"]);
    // Shop codes, phone/ID numbers and addresses never become separate items.
    expect(splitRecap("ร้านทดสอบ 1790898241194-jcn832 99")).toEqual(["ร้านทดสอบ 1790898241194-jcn832 99"]);
    expect(splitRecap("โทรหา 0812345678 ค่าโทร 50")).toEqual(["โทรหา 0812345678 ค่าโทร 50"]);
    expect(splitRecap("ร้าน A1 ข้าว 45 ส่งบ้าน 99/1 ค่าส่ง 20")).toEqual(["ร้าน A1 ข้าว 45", "ส่งบ้าน 99/1 ค่าส่ง 20"]);
    expect(splitRecap("เงินเดือน 20k ข้าว 40")).toEqual(["เงินเดือน 20k", "ข้าว 40"]);
  });

  it("keeps a trailing qualifier with its item and strips joining words", () => {
    expect(splitRecap("ข้าว 40 จ่ายเงินสด แล้วก็กาแฟ 60 กับขนม 20")).toEqual(["ข้าว 40 จ่ายเงินสด", "กาแฟ 60", "ขนม 20"]);
  });

  it("uses newlines and commas as separators, but never a thousands comma", () => {
    expect(splitRecap("ข้าว 40\nน้ำ 10")).toEqual(["ข้าว 40", "น้ำ 10"]);
    expect(splitRecap("ข้าว 40, เงินเดือน 20,000")).toEqual(["ข้าว 40", "เงินเดือน 20,000"]);
  });

  it("returns nothing for empty input", () => {
    expect(splitRecap("   ")).toEqual([]);
  });
});

describe("parseRecap", () => {
  it("reads the evening recap into 4 expenses and 2 incomes with real categories", () => {
    const items = parseRecap(EVENING_RECAP, CTX);
    expect(items.map((i) => [i.type, i.amountCents, i.categoryId])).toEqual([
      ["expense", 4_000, "cat-food"],
      ["expense", 1_000, "cat-food"],
      ["expense", 5_000, "cat-food"],
      ["expense", 8_000, "cat-transport"],
      ["income", 2_000_000, "cat-salary"],
      ["income", 200_000, "cat-other-in"],
    ]);
    expect(isMultiItemRecap(items)).toBe(true);
    expect(recapTotals(items)).toEqual({ expenseCount: 4, expenseCents: 18_000, incomeCount: 2, incomeCents: 2_200_000 });
  });

  it("applies a leading 'เมื่อวาน' to every item without its own date", () => {
    const items = parseRecap("เมื่อวาน ข้าว 40 น้ำ 10", CTX);
    expect(items.map((i) => i.date)).toEqual(["2026-10-01", "2026-10-01"]);
  });

  it("a single item is not a recap (the normal one-item preview handles it)", () => {
    expect(isMultiItemRecap(parseRecap("ข้าว 80 cash", CTX))).toBe(false);
    expect(isMultiItemRecap(parseRecap("7-11 55", CTX))).toBe(false);
  });

  it("'ให้แม่' stays a Family expense while 'แม่ให้' is income", () => {
    const [give, got] = parseRecap("ให้แม่ 500 แม่ให้ 2000", CTX);
    expect(give).toMatchObject({ type: "expense", categoryId: "cat-family" });
    expect(got).toMatchObject({ type: "income" });
  });
});

describe("parser additions used by the recap", () => {
  it("reads spoken Thai magnitudes", () => {
    expect(extractAmount("เงินเดือน 2 หมื่น")?.cents).toBe(2_000_000);
    expect(extractAmount("โบนัส 1 แสน")?.cents).toBe(10_000_000);
    expect(extractAmount("ข้าว 3 พัน")?.cents).toBe(300_000);
  });

  it("learning decides the type: a learned income category flips an unmarked phrase to income", () => {
    const learned: ParseContext = { ...CTX, merchantPreferences: [{ merchant_normalized: "ป้าแดง", category_id: "cat-gift" }] };
    expect(parseCaptureText("ป้าแดง 500", CTX).type).toBe("expense");
    expect(parseCaptureText("ป้าแดง 500", learned)).toMatchObject({ type: "income", categoryId: "cat-gift", categorySource: "learned" });
  });

  it("an explicit expense learning is not overridden by a weaker income guess", () => {
    const learned: ParseContext = { ...CTX, merchantPreferences: [{ merchant_normalized: "กาแฟ", category_id: "cat-food" }] };
    expect(parseCaptureText("กาแฟ 60", learned)).toMatchObject({ type: "expense", categoryId: "cat-food" });
  });
});

describe("recap AI category pass — validated, categories only", () => {
  it("asks only about priced items whose category was a blind 'Other' guess", async () => {
    const { recapItemsNeedingAI } = await import("@/lib/capture/ai-fallback");
    const items = parseRecap("ข้าว 40 ค่าอะไหล่ 300 แม่ให้ 2000", CTX);
    // ข้าว → keyword food; ค่าอะไหล่ → Other (asked); แม่ให้ → income Other (asked)
    expect(recapItemsNeedingAI(items)).toEqual([1, 2]);
  });

  it("keeps only known, type-matching, non-Other categories for indices that were asked", async () => {
    const { normalizeRecapCategoryOutput } = await import("@/lib/capture/ai-fallback");
    const asked = [
      { description: "ค่าอะไหล่", type: "expense" as const },
      { description: "แม่ให้", type: "income" as const },
    ];
    const reply = `Sure: [{"i":0,"category":"Transport"},{"i":1,"category":"Food & Dining"},{"i":5,"category":"Salary"},{"i":1,"category":"Gift"}]`;
    // i=1 "Food & Dining" is an expense category for an income item → dropped; "Gift" fits → kept; i=5 was never asked.
    expect(normalizeRecapCategoryOutput(reply, asked, CTX.categories)).toEqual({ 0: "cat-transport", 1: "cat-gift" });
    expect(normalizeRecapCategoryOutput('[{"i":0,"category":"Other"}]', asked, CTX.categories)).toEqual({});
    expect(normalizeRecapCategoryOutput("not json", asked, CTX.categories)).toEqual({});
  });
});

describe("recap AI category pass — a reply cut off by the token limit", () => {
  it("keeps every complete entry instead of losing the whole batch", async () => {
    const { normalizeRecapCategoryOutput, recapCategoryMaxTokens } = await import("@/lib/capture/ai-fallback");
    const asked = [
      { description: "ค่าอะไหล่", type: "expense" as const },
      { description: "เงินเดือนออก", type: "income" as const },
      { description: "ตั๋วหนัง", type: "expense" as const },
    ];
    const truncated = '[{"i":0,"category":"Transport"},{"i":1,"category":"Salary"},{"i":2,"categ';
    expect(normalizeRecapCategoryOutput(truncated, asked, CTX.categories)).toEqual({ 0: "cat-transport", 1: "cat-salary" });
    // The budget grows with the batch, so a full batch is never cut off in the first place.
    expect(recapCategoryMaxTokens(20)).toBeGreaterThan(recapCategoryMaxTokens(2));
    expect(recapCategoryMaxTokens(20)).toBeGreaterThanOrEqual(600);
  });
});

/** "-230" expense / "+500" income, in order — the shape a user checks on screen. */
function summary(text: string): string[] {
  return parseRecap(text, CTX).map((i) => `${i.type === "income" ? "+" : "-"}${(i.amountCents ?? 0) / 100}`);
}

describe("everyday spoken recaps (reported 2026-10-03)", () => {
  it("does not mistake the start of the next item's name for a quantity unit", () => {
    // "ลูก" is a unit, but here it starts "ลูกชิ้น" — 230 is Grab's price.
    expect(splitRecap("Grab 230 ลูกชิ้น 40")).toEqual(["Grab 230", "ลูกชิ้น 40"]);
    expect(splitRecap("Grab 230 และ ลูกชิ้น 40")).toEqual(["Grab 230", "ลูกชิ้น 40"]);
    expect(summary("Grab 230 ลูกชิ้น 40")).toEqual(["-230", "-40"]);
    // A real unit word still makes a quantity.
    expect(splitRecap("ลูกชิ้น 5 ไม้ 20 น้ำแข็ง 12")).toEqual(["ลูกชิ้น 5 ไม้ 20", "น้ำแข็ง 12"]);
    expect(splitRecap("ข้าวผัด 2 จาน 120 น้ำ 3 ขวด 30")).toEqual(["ข้าวผัด 2 จาน 120", "น้ำ 3 ขวด 30"]);
  });

  it("knows how many items, and which are income or expense", () => {
    expect(summary("ข้าวมันไก่ 50 ชาไทย 35 วินมอไซค์ 20")).toEqual(["-50", "-35", "-20"]);
    expect(summary("ขายของได้ 1500 ซื้อของเข้าร้าน 600")).toEqual(["+1500", "-600"]);
    expect(summary("ได้ค่าจ้าง 3000 จ่ายค่าห้อง 4500")).toEqual(["+3000", "-4500"]);
    expect(summary("เงินเดือนเข้า 25000 โอนให้แม่ 5000")).toEqual(["+25000", "-5000"]);
    expect(summary("ลูกค้าโอนมา 5000 ค่าคอม 800")).toEqual(["+5000", "+800"]);
    expect(summary("ถูกหวย 2000")).toEqual(["+2000"]);
    expect(summary("ขายตูด 500")).toEqual(["+500"]);
    expect(summary("ซื้อจากแม่ค้า 60 ขายเสื้อได้ 300")).toEqual(["-60", "+300"]);
  });

  it("keeps shops that merely sell things as expenses", () => {
    expect(summary("ร้านขายยา 120 ซื้อของร้านขายของชำ 80")).toEqual(["-120", "-80"]);
  });

  it("files everyday street food under food", () => {
    for (const text of ["ลูกชิ้น 40", "ไก่ทอด 40", "ไก่ย่าง 80", "ชาไทย 35", "กะเพราหมูกรอบ 60"]) {
      expect(parseRecap(text, CTX)[0].categoryId, text).toBe("cat-food");
    }
    expect(parseRecap("ล้างรถ 150", CTX)[0].categoryId).toBe("cat-transport");
  });
});

describe("real recap reported 2026-10-05", () => {
  const TEXT =
    "พี่เจนโอนเงินให้ค่าวันเกิด 1000 บาท ปุ้น 280 บาท เงินแท็ก 1-15 ก.ย. เข้า 25,400 อ๋องโอนเงินมาคืน 1760.50 บาท อ๋องโอนเงินค่า CQK ที่ไปกินเลี้ยงงานวันเกิดคืนมาให้ 484 บาท ตี๋กับแฟนตี๋โอนเงินมาให้ที่แชร์ค่า CQK เคที่ไปกินเลี้ยงงานวันเกิดเรา มาให้ 968 บาท ค่าแกร็บไปทำงาน 62 บาทกระเพราหมูสับไข่ดาว 70 บาท";

  it("reads decimals as one amount and money coming in as income", () => {
    const ctx = { ...CTX, categories: [...CTX.categories, SYS("cat-fun", "ความบันเทิง", "Entertainment", "expense"), SYS("cat-refund", "เงินคืน", "Cashback/Refund", "income")] };
    const items = parseRecap(TEXT, ctx);
    expect(items.map((i) => [i.type, i.amountCents])).toEqual([
      ["income", 100000],
      ["expense", 28000],
      ["income", 2540000],
      ["income", 176050],
      ["income", 48400],
      ["income", 96800],
      ["expense", 6200],
      ["expense", 7000],
    ]);
    expect(items[1].categoryId).toBe("cat-fun");
    expect(items[3].categoryId).toBe("cat-refund");
    expect(items[2].description).toContain("ก.ย.");
  });

  it("keeps transfers I sent as expenses", () => {
    expect(parseCaptureText("โอนเงินให้แม่ 2000", CTX).type).toBe("expense");
    expect(parseCaptureText("ฉันโอนเงินให้อ๋อง 500", CTX).type).toBe("expense");
    expect(parseCaptureText("ค่าเข้า สวนสัตว์ 100", CTX).type).toBe("expense");
  });
});

describe("Gift categories (migration 0039)", () => {
  const ctx = { ...CTX, categories: [...CTX.categories, SYS("cat-gift-out", "ของขวัญ", "Gift", "expense")] };

  it("files money received as a gift under income Gift", () => {
    const got = parseCaptureText("พี่เจนโอนเงินให้ค่าวันเกิด 1000 บาท", ctx);
    expect([got.type, got.categoryId]).toEqual(["income", "cat-gift"]);
    expect(parseCaptureText("ได้อั่งเปา 500", ctx)).toMatchObject({ type: "income", categoryId: "cat-gift" });
  });

  it("gift words alone never turn a gift I bought into income", () => {
    expect(parseCaptureText("ซื้อของขวัญให้แฟน 1200", ctx)).toMatchObject({ type: "expense", categoryId: "cat-gift-out" });
    expect(parseCaptureText("อั่งเปาหลาน 500", ctx)).toMatchObject({ type: "expense", categoryId: "cat-gift-out" });
  });
});
