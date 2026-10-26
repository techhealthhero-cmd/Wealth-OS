import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MonthHeroView } from "@/features/transactions/components/month-hero";
import { DayCalendarView } from "@/features/transactions/components/wall-calendar";
import { dayTone, spendMix } from "@/features/transactions/lib/day-heat";
import { buildMonthGrid } from "@/lib/financial/week-strip";
import { formatMoney } from "@/lib/financial/money";
import { moneyCalendarText } from "@/lib/money-calendar-text";
import en from "@/i18n/locales/en.json";
import th from "@/i18n/locales/th.json";

const labels = {
  goal: th.transactions.month.heroGoal,
  month: th.transactions.month.heroMonth,
  income: th.transactions.month.income,
  expense: th.transactions.month.expense,
  net: th.transactions.month.net,
  budgetUsed: th.transactions.month.budgetUsed,
  budgetUsedShort: th.transactions.month.budgetUsedShort,
  budgetFoot: th.transactions.month.budgetFoot,
  budgetLeft: th.transactions.month.budgetLeft,
  budgetOver: th.transactions.month.budgetOver,
  previous: th.transactions.week.previous,
  next: th.transactions.week.next,
};

function hero(budget: { percentUsed: number; remainingCents: number } | null, income = 400_000, expense = 984_500) {
  return renderToStaticMarkup(
    createElement(MonthHeroView, {
      title: "ตุลาคม 2569",
      incomeCents: income,
      expenseCents: expense,
      budget,
      currencyCode: "THB",
      labels,
      nextDisabled: budget === null,
      onPrevious() {},
      onNext() {},
    }),
  );
}

describe("finance month variant B", () => {
  it("keeps the Thai and English month copy in step", () => {
    const keys = ["net", "heroGoal", "heroMonth", "budgetUsedShort", "budgetFoot", "calendarTitle", "tapDay", "selectedDay"] as const;
    for (const key of keys) {
      expect(th.transactions.month[key].length).toBeGreaterThan(0);
      expect(en.transactions.month[key].length).toBeGreaterThan(0);
    }
    expect(th.transactions.month.heroGoal).toBe("เป้าหมายรายเดือน");
    expect(th.transactions.month.calendarTitle).toBe("ปฏิทินรายวัน");
    expect(th.transactions.month.tapDay).toBe("แตะวันเพื่อดูรายการ");
    expect(th.transactions.month.selectedDay).toBe("เลือกแล้ว · {day}");
    expect(th.transactions.week.heatSpend).toBe("ยิ่งเข้ม ยิ่งใช้มาก");
    expect(th.transactions.week.heatIncome).toBe("วันที่เงินเข้า");
    expect(en.transactions.week.heatSpend).toBe("Darker means more spent");
    expect(en.transactions.week.heatIncome).toBe("Income day");
  });

  it("paints a busier day a darker red and an income day green", () => {
    expect(spendMix(0)).toBe(32);
    expect(spendMix(0.5)).toBe(66);
    expect(spendMix(1)).toBe(100);
    expect(spendMix(-2)).toBe(32);
    expect(spendMix(4)).toBe(100);
    expect(dayTone({ netCents: 100, spentCents: 50 }, 100)).toEqual({ kind: "income" });
    expect(dayTone({ netCents: -50, spentCents: 50 }, 200)).toEqual({ kind: "spend", ratio: 0.25 });
    expect(dayTone({ netCents: 0, spentCents: 0 }, 200)).toEqual({ kind: "empty" });
    expect(dayTone({ netCents: -10, spentCents: 10 }, 0)).toEqual({ kind: "empty" });
  });

  it("shows income, spending, net, and the budget only when one exists", () => {
    const withBudget = hero({ percentUsed: 49.4, remainingCents: 1_015_600 });
    expect(withBudget).toContain("เป้าหมายรายเดือน");
    expect(withBudget).toContain("ตุลาคม 2569");
    expect(withBudget).toContain("สุทธิ");
    expect(withBudget).toContain(`-${formatMoney(584_500, "THB", "th-TH", 0)}`);
    expect(withBudget).toContain(`+${formatMoney(400_000, "THB", "th-TH", 0)}`);
    expect(withBudget).toContain(`-${formatMoney(984_500, "THB", "th-TH", 0)}`);
    expect(withBudget).toContain("งบใช้ไป");
    expect(withBudget).toContain("49%");
    expect(withBudget).toContain("งบเดือนนี้");
    expect(withBudget).toContain(`เหลือ ${formatMoney(1_015_600, "THB", "th-TH", 0)}`);
    expect(withBudget).toContain('role="progressbar"');
    expect(withBudget).toContain("text-[#f6d3b8]");
    expect(withBudget).not.toContain('disabled=""');

    const open = hero(null, 200_000, 50_000);
    expect(open).toContain("เดือนนี้");
    expect(open).not.toContain("เป้าหมายรายเดือน");
    expect(open).not.toContain("งบใช้ไป");
    expect(open).not.toContain('role="progressbar"');
    expect(open).toContain("text-[#7fd6b2]");
    expect(open).toContain('disabled=""');

    const over = hero({ percentUsed: 120, remainingCents: -20_000 });
    expect(over).toContain("120%");
    expect(over).toContain(`เกินงบ ${formatMoney(20_000, "THB", "th-TH", 0)}`);
    expect(over).toContain("bg-[#f0b4a8]");
  });

  it("shows every day of the month, selects one day, and drops the paper fold", () => {
    const grid = buildMonthGrid(
      "2026-10",
      "2026-10-31",
      [
        { transaction_date: "2026-10-08", type: "income", amount: "1180" },
        { transaction_date: "2026-10-02", type: "expense", amount: "990" },
        { transaction_date: "2026-10-26", type: "expense", amount: "175" },
        { transaction_date: "2026-10-30", type: "expense", amount: "1450" },
      ],
      ["2026-10-02"],
    );
    const html = renderToStaticMarkup(
      createElement(DayCalendarView, {
        grid,
        text: moneyCalendarText(grid, "th"),
        selectedDate: "2026-10-26",
        labels: {
          title: th.transactions.month.calendarTitle,
          tapDay: th.transactions.month.tapDay,
          selectedDay: th.transactions.month.selectedDay,
          heatSpend: th.transactions.week.heatSpend,
          heatIncome: th.transactions.week.heatIncome,
          hasPending: th.transactions.week.hasPending,
          today: th.transactions.today,
        },
        onPickDay() {},
      }),
    );

    expect(html.match(/data-testid="finance-day-\d/g)).toHaveLength(35);
    expect(html).toContain("ปฏิทินรายวัน");
    expect(html).toContain("เลือกแล้ว · 26");
    expect(html).not.toContain("แตะวันเพื่อดูรายการ");
    expect(html).toContain("ยิ่งเข้ม ยิ่งใช้มาก");
    expect(html).toContain("วันที่เงินเข้า");
    expect(html).not.toContain("wall-curl");
    expect(html).not.toContain("พลิกมุม");

    const selected = html.match(/<button\b[^>]*data-testid="finance-day-2026-10-26"[^>]*>/)?.[0];
    expect(selected).toContain('aria-pressed="true"');
    expect(selected).toContain("bg-[#1b4335]");

    const income = html.match(/<button\b[^>]*data-testid="finance-day-2026-10-08"[^>]*>/)?.[0];
    expect(income).toContain('data-tone="income"');
    expect(income).toContain('aria-pressed="false"');

    const heavy = html.match(/<button\b[^>]*data-testid="finance-day-2026-10-30"[^>]*>/)?.[0];
    const light = html.match(/<button\b[^>]*data-testid="finance-day-2026-10-02"[^>]*>/)?.[0];
    expect(heavy).toContain('data-tone="spend"');
    expect(light).toContain('data-tone="spend"');
    expect(heavy).toContain("--spend:100%");
    expect(light).toMatch(/--spend:\d+%/);
    expect(light).not.toContain("--spend:100%");
    expect(light).toContain("มีรายการรอตรวจ");

    const today = html.match(/<button\b[^>]*data-testid="finance-day-2026-10-31"[^>]*>/)?.[0];
    expect(today).toContain('data-today="true"');
    expect(today).toContain("bg-[#efe6d4]");
    expect(today).toContain('data-tone="empty"');

    const edge = html.match(/<button\b[^>]*data-testid="finance-day-2026-11-01"[^>]*>/)?.[0];
    expect(edge).toContain('data-tone="empty"');
    expect(edge).not.toContain("disabled");
  });
});
