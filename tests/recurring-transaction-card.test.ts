import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { RecurringTransaction } from "@/types/database";

vi.mock("@/features/recurring/actions", () => ({
  confirmRecurringTransaction: vi.fn(),
  deleteRecurringTransaction: vi.fn(),
}));
vi.mock("@/features/recurring/components/recurring-transaction-form", () => ({
  RecurringTransactionForm: () => null,
}));
vi.mock("@/components/shared/confirm-dialog", () => ({
  useConfirmDialog: () => ({ confirm: vi.fn(), dialog: null }),
}));
vi.mock("@/i18n/client", () => ({
  useTranslation: () => ({
    locale: "th",
    t: (key: string) => key === "recurring.confirmButton" ? "ยืนยันและบันทึกรายการ" : key,
  }),
}));

import { RecurringTransactionCard } from "@/features/recurring/components/recurring-transaction-card";

const recurring = {
  id: "recurring-1", merchant: "Monthly bill", description: "Bill description",
  type: "expense", amount: "1234.00", frequency: "monthly", next_due_date: "2000-01-01", is_active: true,
} as RecurringTransaction;

function render(overrides: Partial<RecurringTransaction> = {}) {
  return renderToStaticMarkup(createElement(RecurringTransactionCard, {
    recurring: { ...recurring, ...overrides }, accounts: [], categories: [],
  }));
}

describe("recurring confirmation icon", () => {
  it("has the Thai accessible label and tooltip without visible long text", () => {
    const html = render();
    const button = html.match(/<button\b[^>]*aria-label="ยืนยันและบันทึกรายการ"[^>]*>[\s\S]*?<\/button>/)?.[0];
    expect(button).toBeDefined();
    expect(button).toContain('title="ยืนยันและบันทึกรายการ"');
    expect(button).toContain('aria-busy="false"');
    expect(button).toContain("lucide-check");
    expect(button?.replace(/<[^>]*>/g, "")).toBe("");
    expect(html).toContain("1,234");
  });

  it.each([{ is_active: false }, { next_due_date: "2999-01-01" }])("hides confirmation when unavailable: %s", (overrides) => {
    expect(render(overrides)).not.toContain('aria-label="ยืนยันและบันทึกรายการ"');
  });
});
