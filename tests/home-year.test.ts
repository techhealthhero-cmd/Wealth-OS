import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NetWorthCompactCard } from "@/features/dashboard/components/net-worth-compact-card";
import { HomeYearView } from "@/features/dashboard/components/home-year-view";
import {
  aggregateHomeYear,
  buddhistYear,
  goalsInYear,
  homeYearOptions,
  longMonthName,
  parseHomeYear,
  throughMonthLabel,
  type HomeYearTransaction,
} from "@/features/dashboard/lib/home-year";
import {
  classifyYearDeltaBaseline,
  yearChangeLookupWindow,
} from "@/features/dashboard/net-worth-baseline";
import th from "@/i18n/locales/th.json";
import { formatMoney } from "@/lib/financial/money";

const copy = { locale: "th" as const, uncategorized: "ไม่ระบุหมวด", other: "อื่นๆ" };
const categories = [
  { id: "home", name_th: "ค่าบ้าน", name_en: "Housing" },
  { id: "food", name_th: "ค่าอาหาร", name_en: "Food" },
  { id: "shop", name_th: "ช้อปปิ้ง", name_en: "Shopping" },
  { id: "travel", name_th: "เดินทาง", name_en: "Transport" },
];

function tx(
  partial: Partial<HomeYearTransaction> & Pick<HomeYearTransaction, "type" | "amount" | "transaction_date">,
): HomeYearTransaction {
  return { category_id: null, ...partial };
}

describe("home year selection", () => {
  it("labels the current year and the two before it in Buddhist era", () => {
    expect(buddhistYear(2026)).toBe(2569);
    expect(homeYearOptions("2026-10-26").map((option) => option.buddhist)).toEqual([2569, 2568, 2567]);
    expect(homeYearOptions("2026-10-26").map((option) => option.href)).toEqual([
      "/dashboard",
      "/dashboard?year=2568",
      "/dashboard?year=2567",
    ]);
  });

  it("accepts only the three Buddhist years and ignores a Gregorian year", () => {
    expect(parseHomeYear(undefined, "2026-10-26")).toBe(2026);
    expect(parseHomeYear("2568", "2026-10-26")).toBe(2025);
    expect(parseHomeYear("2567", "2026-10-26")).toBe(2024);
    expect(parseHomeYear("2566", "2026-10-26")).toBe(2026);
    expect(parseHomeYear("2025", "2026-10-26")).toBe(2026);
    expect(parseHomeYear("nope", "2026-10-26")).toBe(2026);
  });

  it("marks only the current year as still in progress", () => {
    expect(throughMonthLabel("2026-10-26", 2026, "th")).toBe("ต.ค.");
    expect(throughMonthLabel("2026-10-26", 2025, "th")).toBeNull();
    expect(throughMonthLabel("2026-10-26", 2026, "en")).toBe("Oct");
    expect(longMonthName("2026-10-26", "th")).toBe("ตุลาคม");
  });
});

describe("aggregateHomeYear", () => {
  it("compares the selected full year with the previous full year and nets refunds", () => {
    const rows: HomeYearTransaction[] = [
      tx({ type: "income", amount: "312400.00", transaction_date: "2026-03-01", category_id: "salary" }),
      tx({ type: "income", amount: "5000.00", transaction_date: "2025-12-31", category_id: "salary" }),
      tx({ type: "income", amount: "9999.00", transaction_date: "2024-12-31", category_id: "salary" }),
      tx({ type: "expense", amount: "85000.00", transaction_date: "2026-06-01", category_id: "home" }),
      tx({ type: "expense", amount: "1000.00", transaction_date: "2026-11-15", category_id: "home" }),
      tx({ type: "refund", amount: "1000.00", transaction_date: "2026-11-20", category_id: "home" }),
      tx({ type: "expense", amount: "100000.00", transaction_date: "2025-01-15", category_id: "home" }),
      tx({ type: "expense", amount: "42300.00", transaction_date: "2026-08-01", category_id: "food" }),
      tx({ type: "expense", amount: "48500.00", transaction_date: "2025-08-01", category_id: "food" }),
      tx({ type: "expense", amount: "22150.00", transaction_date: "2026-09-01", category_id: "shop" }),
      tx({ type: "expense", amount: "19000.00", transaction_date: "2025-09-01", category_id: "shop" }),
      tx({ type: "expense", amount: "18200.00", transaction_date: "2026-04-01", category_id: "travel" }),
      tx({ type: "expense", amount: "17800.00", transaction_date: "2025-04-01", category_id: "travel" }),
      tx({ type: "transfer", amount: "50000.00", transaction_date: "2026-05-01", category_id: "home" }),
      tx({ type: "expense", amount: "70000.00", transaction_date: "2024-02-01", category_id: "home" }),
    ];

    const summary = aggregateHomeYear(rows, categories, 2026, copy);

    expect(summary.incomeCents).toBe(31_240_000);
    expect(summary.expenseCents).toBe(16_765_000);
    expect(summary.savedCents).toBe(summary.incomeCents - summary.expenseCents);
    expect(summary.categories.map((row) => [row.label, row.currentCents, row.previousCents])).toEqual([
      ["ค่าบ้าน", 8_500_000, 10_000_000],
      ["ค่าอาหาร", 4_230_000, 4_850_000],
      ["ช้อปปิ้ง", 2_215_000, 1_900_000],
      ["เดินทาง", 1_820_000, 1_780_000],
    ]);
    expect(summary.categories.reduce((sum, row) => sum + row.currentCents, 0)).toBe(summary.expenseCents);
    expect(summary.insight).toMatchObject({
      label: "ค่าบ้าน",
      direction: "down",
      currentCents: 8_500_000,
      previousCents: 10_000_000,
    });
  });

  it("folds categories past the eighth row into อื่นๆ and keeps both year columns whole", () => {
    const many = Array.from({ length: 9 }, (_, index) => ({
      id: `c${index}`,
      name_th: `หมวด${index}`,
      name_en: `Cat${index}`,
    }));
    const rows = many.flatMap((category, index) => [
      tx({
        type: "expense",
        amount: String(1000 - index * 10),
        transaction_date: "2026-02-01",
        category_id: category.id,
      }),
      tx({
        type: "expense",
        amount: String(500 - index * 10),
        transaction_date: "2025-02-01",
        category_id: category.id,
      }),
    ]);

    const summary = aggregateHomeYear(rows, many, 2026, copy);
    expect(summary.categories).toHaveLength(8);
    expect(summary.categories.filter((row) => row.label === "อื่นๆ")).toHaveLength(1);
    expect(summary.categories.find((row) => row.isOther)).toMatchObject({ id: "other", label: "อื่นๆ" });
    expect(summary.categories.map((row) => row.currentCents)).toEqual(
      [...summary.categories].map((row) => row.currentCents).sort((a, b) => b - a),
    );
    expect(summary.categories.reduce((sum, row) => sum + row.currentCents, 0)).toBe(summary.expenseCents);
    expect(summary.categories.reduce((sum, row) => sum + row.previousCents, 0)).toBe(
      aggregateHomeYear(rows, many, 2025, copy).expenseCents,
    );
  });

  it("merges other, a same-named second category, and uncategorized into one อื่นๆ row", () => {
    const cats = [
      ...categories,
      { id: "exp-other", name_th: "อื่นๆ", name_en: "Other" },
      { id: "inc-other", name_th: "อื่นๆ", name_en: "Other" },
    ];
    const summary = aggregateHomeYear(
      [
        tx({ type: "expense", amount: "7992.00", transaction_date: "2026-01-15", category_id: "home" }),
        tx({ type: "expense", amount: "1708.00", transaction_date: "2026-02-01", category_id: "exp-other" }),
        tx({ type: "expense", amount: "3000.00", transaction_date: "2026-02-02", category_id: "inc-other" }),
        tx({ type: "expense", amount: "1479.14", transaction_date: "2026-02-03", category_id: null }),
        tx({ type: "expense", amount: "10.00", transaction_date: "2026-02-04", category_id: "missing" }),
      ],
      cats,
      2026,
      copy,
    );

    const others = summary.categories.filter((row) => row.label === "อื่นๆ");
    expect(others).toHaveLength(1);
    expect(others[0]).toMatchObject({ id: "other", isOther: true, currentCents: 618_714 + 1_000 });
    expect(summary.categories.map((row) => row.label)).toEqual(["ค่าบ้าน", "อื่นๆ"]);
    expect(summary.categories.map((row) => row.currentCents)).toEqual([799_200, 619_714]);
  });

  it("folds the overflow into the existing อื่นๆ row instead of adding a second one", () => {
    const many = [
      { id: "exp-other", name_th: "อื่นๆ", name_en: "Other" },
      ...Array.from({ length: 8 }, (_, index) => ({
        id: `c${index}`,
        name_th: `หมวด${index}`,
        name_en: `Cat${index}`,
      })),
    ];
    const rows = [
      tx({ type: "expense", amount: "5000.00", transaction_date: "2026-01-02", category_id: "exp-other" }),
      ...many.slice(1).map((category, index) =>
        tx({
          type: "expense",
          amount: String(100 - index),
          transaction_date: "2026-01-03",
          category_id: category.id,
        }),
      ),
    ];

    const summary = aggregateHomeYear(rows, many, 2026, copy);
    const others = summary.categories.filter((row) => row.label === "อื่นๆ");
    expect(summary.categories).toHaveLength(8);
    expect(others).toHaveLength(1);
    expect(others[0].isOther).toBe(true);
    expect(others[0].currentCents).toBeGreaterThan(500_000);
    expect(summary.categories.reduce((sum, row) => sum + row.currentCents, 0)).toBe(summary.expenseCents);
    expect(summary.categories.map((row) => row.currentCents)).toEqual(
      [...summary.categories].map((row) => row.currentCents).sort((a, b) => b - a),
    );
  });

  it("merges a null category into Other for English", () => {
    const summary = aggregateHomeYear(
      [
        tx({ type: "expense", amount: "10.00", transaction_date: "2026-01-02", category_id: "exp-other" }),
        tx({ type: "expense", amount: "5.00", transaction_date: "2026-01-03", category_id: null }),
      ],
      [{ id: "exp-other", name_th: "อื่นๆ", name_en: "Other" }],
      2026,
      { locale: "en", uncategorized: "Uncategorized", other: "Other" },
    );
    expect(summary.categories).toEqual([
      expect.objectContaining({ id: "other", label: "Other", currentCents: 1_500, isOther: true }),
    ]);
  });

  it("does not narrate a category move under ฿500", () => {
    const summary = aggregateHomeYear(
      [
        tx({ type: "expense", amount: "1000.00", transaction_date: "2026-01-02", category_id: "food" }),
        tx({ type: "expense", amount: "800.00", transaction_date: "2025-01-02", category_id: "food" }),
      ],
      categories,
      2026,
      copy,
    );
    expect(summary.insight).toBeNull();
  });
});

describe("goalsInYear", () => {
  const goals = [
    { id: "a", target_date: "2026-12-31" },
    { id: "b", target_date: "2026-01-01T00:00:00" },
    { id: "c", target_date: "2025-12-31" },
    { id: "d", target_date: null },
    { id: "e", target_date: "2027-01-01" },
  ];

  it("keeps goals whose deadline falls in the selected year", () => {
    expect(goalsInYear(goals, 2026).map((goal) => goal.id)).toEqual(["a", "b"]);
    expect(goalsInYear(goals, 2025).map((goal) => goal.id)).toEqual(["c"]);
  });
});

describe("year net-worth baseline", () => {
  it("treats a snapshot on or just before 1 Jan as this year", () => {
    expect(yearChangeLookupWindow("2026-10-26")).toEqual({
      nearFrom: "2025-10-01",
      nearTo: "2026-01-01",
      inYearFrom: "2026-01-02",
    });
    expect(classifyYearDeltaBaseline("2026-01-01", "2026-10-26")).toBe("year");
    expect(classifyYearDeltaBaseline("2025-12-15", "2026-10-26")).toBe("year");
    expect(classifyYearDeltaBaseline("2025-06-01", "2026-10-26")).toBe("since");
    expect(classifyYearDeltaBaseline("2026-05-02", "2026-10-26")).toBe("since");
    expect(classifyYearDeltaBaseline("2026-10-26", "2026-10-26")).toBeNull();
  });
});

describe("Home year presentation", () => {
  const summary = aggregateHomeYear(
    [
      tx({ type: "income", amount: "312400.00", transaction_date: "2026-02-01" }),
      tx({ type: "expense", amount: "100000.00", transaction_date: "2025-03-01", category_id: "home" }),
      tx({ type: "expense", amount: "85000.00", transaction_date: "2026-03-01", category_id: "home" }),
    ],
    categories,
    2026,
    copy,
  );

  it("renders the year switcher, savings, comparison and a calm empty goal state", () => {
    const html = renderToStaticMarkup(
      createElement(HomeYearView, {
        labels: th.homeYear,
        locale: "th",
        currencyCode: "THB",
        selectedYear: 2026,
        options: homeYearOptions("2026-10-26"),
        throughMonth: "ต.ค.",
        ...summary,
        goals: [],
      }),
    );
    expect(html).toContain("ภาพรวมรายปี");
    expect(html).toContain("ถึง ต.ค.");
    expect(html).toContain("ออมได้ปี 2569");
    expect(html).toContain("ค่าบ้านปี 69 ลดลง จากปี 68");
    expect(html).toContain("ปี 2569 ยังไม่มีเป้าหมายที่ถึงกำหนด");
    expect(html).toContain('href="/plan/goals"');
    expect(html).toContain('href="/dashboard?year=2568"');
    expect(html).toContain(formatMoney(31_240_000, "THB", "th-TH", 0));
    expect(html).not.toContain("GoalProgressCard");
  });

  it("shows a goal whose deadline is in the selected year", () => {
    const html = renderToStaticMarkup(
      createElement(HomeYearView, {
        labels: th.homeYear,
        locale: "th",
        currencyCode: "THB",
        selectedYear: 2026,
        options: homeYearOptions("2026-10-26"),
        throughMonth: "ต.ค.",
        ...summary,
        goals: [
          {
            id: "g1",
            name: "เที่ยวญี่ปุ่น",
            status: "active",
            progress: 40,
            currentCents: 2_000_000,
            targetCents: 5_000_000,
            targetLabel: "31 ธ.ค.",
          },
        ],
      }),
    );
    expect(html).toContain("เป้าหมายปี 2569");
    expect(html).toContain("เที่ยวญี่ปุ่น");
    expect(html).toContain("31 ธ.ค.");
    expect(html).toContain("ภายใน 31 ธ.ค.");
    expect(html).toContain("ดูทั้งหมด");
    expect(html).toContain('data-testid="home-year-goal-note"');
    expect(html).toContain('aria-valuenow="40"');
    expect(html).toContain('data-previous="true"');
    expect(html).toContain("ปี 2568");
    expect(html).not.toContain("ยังไม่มีบันทึก");
  });

  it("skips a zero previous-year line unless every category is zero", () => {
    const html = renderToStaticMarkup(
      createElement(HomeYearView, {
        labels: th.homeYear,
        locale: "th",
        currencyCode: "THB",
        selectedYear: 2026,
        options: homeYearOptions("2026-10-26"),
        throughMonth: null,
        incomeCents: 1_000_000,
        expenseCents: 300_000,
        savedCents: 700_000,
        categories: [
          { id: "home", label: "ที่พัก", currentCents: 200_000, previousCents: 100_000, isOther: false },
          { id: "food", label: "อาหาร", currentCents: 100_000, previousCents: 0, isOther: false },
        ],
        insight: null,
        goals: [],
      }),
    );
    const block = html.slice(html.indexOf('data-testid="home-year-categories"'), html.indexOf('data-testid="home-year-goals"'));
    expect(block).toContain("ปี 2568");
    expect(block).not.toContain("฿0");
    expect(html).not.toContain("ยังไม่มีบันทึก");
  });

  it("draws gold share percents and one note when the previous year is all zero", () => {
    const html = renderToStaticMarkup(
      createElement(HomeYearView, {
        labels: th.homeYear,
        locale: "th",
        currencyCode: "THB",
        selectedYear: 2026,
        options: homeYearOptions("2026-10-26"),
        throughMonth: null,
        incomeCents: 3_808_550,
        expenseCents: 3_071_049,
        savedCents: 737_501,
        categories: [
          { id: "home", label: "ที่พัก", currentCents: 799_200, previousCents: 0, isOther: false },
          { id: "other", label: "อื่นๆ", currentCents: 618_714, previousCents: 0, isOther: true },
        ],
        insight: null,
        goals: [],
      }),
    );
    const categories = html.slice(html.indexOf('data-testid="home-year-categories"'), html.indexOf('data-testid="home-year-goals"'));
    expect(html).toContain("ปี 2568 ยังไม่มีบันทึก (฿0 ทุกหมวด)");
    expect(html).toContain('data-previous="false"');
    expect(html).toContain("100%");
    expect(html).toContain("77%");
    expect(html).toContain("+");
    expect(html).toContain("−");
    expect(html).toContain("decoration-double");
    expect(categories.match(/อื่นๆ/g)).toHaveLength(1);
    expect(html).toContain("ตั้งเป้าหมาย");
    expect(html).not.toContain("home-year-goal-note");
    expect(html).not.toMatch(/text-red|text-destructive|#b4574a|#dc2626|#ef4444/);
  });

  it("keeps a negative ออมได้ gold and double-underlined", () => {
    const html = renderToStaticMarkup(
      createElement(HomeYearView, {
        labels: th.homeYear,
        locale: "th",
        currencyCode: "THB",
        selectedYear: 2026,
        options: homeYearOptions("2026-10-26"),
        throughMonth: null,
        incomeCents: 100_000,
        expenseCents: 250_000,
        savedCents: -150_000,
        categories: [{ id: "food", label: "อาหาร", currentCents: 250_000, previousCents: 0, isOther: false }],
        insight: null,
        goals: [],
      }),
    );
    const saved = html.match(/<span data-testid="home-year-saved"[^>]*>/)?.[0] ?? "";
    expect(saved).toContain("decoration-double");
    expect(saved).toContain("text-[#8a6a2f]");
    expect(html).toContain("−");
    expect(html).not.toMatch(/text-red|text-destructive|#b4574a|#dc2626|#ef4444/);
  });
});

describe("compact net worth card", () => {
  const labels = {
    ...th.homeNetWorth,
    noHistoryYet: th.netWorth.noHistoryYet,
    viewAssetsAndLiabilities: th.netWorth.viewAssetsAndLiabilities,
  };

  it("shows this year's change and this month's spend on the gold card", () => {
    const html = renderToStaticMarkup(
      createElement(NetWorthCompactCard, {
        labels,
        netWorthCents: 24_890_000,
        currencyCode: "THB",
        displayName: "Dom",
        delta: { scope: "year", monthLabel: "ธ.ค.", change: { changeCents: 3_240_000, changePercent: 15 } },
        monthSpend: { monthLabel: "ตุลาคม", cents: 1_842_000 },
      }),
    );
    expect(html).toContain("มูลค่าสุทธิ");
    expect(html).toContain("WEALTH OS");
    expect(html).toContain("DOM");
    expect(html).toContain("+");
    expect(html).toContain("ปีนี้");
    expect(html).toContain("ตุลาคมใช้ไป");
    expect(html).toContain(formatMoney(24_890_000, "THB", "th-TH", 0));
    expect(html).toContain('href="/money/net-worth"');
    expect(html).toContain("whitespace-nowrap");
    expect(html).not.toContain("text-[#f6d3b8]");
    expect(html).not.toContain("text-[#7fd6b2]");
  });

  it("keeps a negative balance dark green, on one line, with smaller satang", () => {
    const html = renderToStaticMarkup(
      createElement(NetWorthCompactCard, {
        labels,
        netWorthCents: -25_432_635,
        currencyCode: "THB",
        displayName: "Dom",
        delta: { scope: "since", monthLabel: "ก.ย.", change: { changeCents: -26_932_635, changePercent: null } },
        monthSpend: null,
      }),
    );
    expect(html).toContain("-฿254,326");
    expect(html).toContain(".35");
    expect(html).toContain("text-[0.6em]");
    expect(html).toContain("min(40px");
    expect(html).toContain("whitespace-nowrap");
    expect(html).toContain("text-[#1f3a2c]");
    expect(html).toContain("ลดลง");
    expect(html).not.toContain("text-[#f6d3b8]");
    expect(html).not.toContain("#b4574a");
  });
});
