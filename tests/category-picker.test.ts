import { createElement, type ReactElement } from "react";
import { jsx } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CategoryPicker } from "@/features/transactions/components/category-picker";
import { I18nProvider } from "@/i18n/client";
import { getDictionary } from "@/i18n/dictionaries";
import type { Category } from "@/types/database";

/** The system expense set, in sort_order. More than the old 8-chip window. */
const EXPENSE = [
  ["อาหาร", "Food & Dining"],
  ["เดินทาง", "Transport"],
  ["ที่พัก", "Housing"],
  ["ช้อปปิ้ง", "Shopping"],
  ["สุขภาพ", "Health"],
  ["ความบันเทิง", "Entertainment"],
  ["การศึกษา", "Education"],
  ["ค่าสาธารณูปโภค", "Utilities"],
  ["สมาชิก/Subscription", "Subscriptions"],
  ["ประกัน", "Insurance"],
  ["ครอบครัว", "Family"],
  ["ของขวัญ", "Gift"],
  ["สนับสนุนทำงาน", "Work Support"],
  ["อื่นๆ", "Other"],
] as const;

function category(index: number): Category {
  const [name_th, name_en] = EXPENSE[index];
  return {
    id: `cat-${index}`,
    user_id: null,
    name_th,
    name_en,
    type: "expense",
    icon: "utensils",
    is_system: true,
    sort_order: (index + 1) * 10,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

function render(locale: "th" | "en", value: string | null) {
  const node: ReactElement = createElement(CategoryPicker, {
    name: "category_id",
    categories: EXPENSE.map((_, index) => category(index)),
    value,
    onValueChange: () => {},
  });
  return renderToStaticMarkup(jsx(I18nProvider, { locale, dict: getDictionary(locale), children: node }));
}

describe("category picker", () => {
  it("shows every category immediately, with no expand or collapse chip", () => {
    const html = render("th", null);
    expect(html.match(/role="radio"/g)).toHaveLength(EXPENSE.length);
    for (const [name] of EXPENSE) expect(html).toContain(name);
    expect(html).toContain("เลือกหมวดหมู่");
    for (const hidden of ["ดูทั้งหมด", "แสดงน้อยลง", "View all", "Show less"]) {
      expect(html).not.toContain(hidden);
    }
    expect(html).not.toContain("border-dashed");
  });

  it("uses the English names and still lists categories past the old first eight", () => {
    const html = render("en", "cat-13");
    for (const [, name] of EXPENSE) expect(html).toContain(name.replaceAll("&", "&amp;"));
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("data-category-selected-marker");
    expect(html).not.toContain("Select category");
    expect(html).not.toContain("View all");
    expect(html).not.toContain("Show less");
  });
});
