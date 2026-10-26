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
    expect(summary.categories.at(-1)).toMatchObject({ id: "other", label: "อื่นๆ", isOther: true });
    expect(summary.categories.reduce((sum, row) => sum + row.currentCents, 0)).toBe(summary.expenseCents);
    expect(summary.categories.reduce((sum, row) => sum + row.previousCents, 0)).toBe(
      aggregateHomeYear(rows, many, 2025, copy).expenseCents,
    );
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
    expect(html).toContain('aria-valuenow="40"');
  });
});

describe("compact net worth card", () => {
  const labels = {
    ...th.homeNetWorth,
    noHistoryYet: th.netWorth.noHistoryYet,
    viewAssetsAndLiabilities: th.netWorth.viewAssetsAndLiabilities,
  };

  it("shows this year's change and this month's spend", () => {
    const html = renderToStaticMarkup(
      createElement(NetWorthCompactCard, {
        labels,
        netWorthCents: 24_890_000,
        currencyCode: "THB",
        delta: { scope: "year", monthLabel: "ธ.ค.", change: { changeCents: 3_240_000, changePercent: 15 } },
        monthSpend: { monthLabel: "ตุลาคม", cents: 1_842_000 },
      }),
    );
    expect(html).toContain("มูลค่าสุทธิ");
    expect(html).toContain("รายละเอียด");
    expect(html).toContain("+");
    expect(html).toContain("ปีนี้");
    expect(html).toContain("ตุลาคมใช้ไป");
    expect(html).toContain(formatMoney(24_890_000, "THB", "th-TH", 0));
    expect(html).toContain('href="/money/net-worth"');
  });
});
