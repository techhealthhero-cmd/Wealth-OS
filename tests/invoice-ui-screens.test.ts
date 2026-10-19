import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import th from "@/i18n/locales/th.json";
import en from "@/i18n/locales/en.json";
import { InvoiceListScreen } from "@/features/invoices/components/invoice-list-screen";
import { InvoiceDetailScreen } from "@/features/invoices/components/invoice-detail-screen";
import { InvoiceFormScreen } from "@/features/invoices/components/invoice-form-screen";
import { InvoiceReminderScreen } from "@/features/invoices/components/invoice-reminder-screen";
import { CopyFallback, ThaiDateField } from "@/features/invoices/components/shared";
import { MoneyChrome } from "@/components/layout/money-chrome";
import { invoice } from "./fixtures/invoice-ui";
let pathname = "/money/invoices";
vi.mock("next/navigation", () => ({ usePathname: () => pathname, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/layout/money-tabs", () => ({
  MoneyTabs: ({ children }: { children: React.ReactNode }) => createElement("div", null, "money-tabs", children),
}));
const copy = th.invoiceUi;
const today = "2026-10-19";
const accounts = [{ id: invoice.receiveAccountId!, name: "SCB ออมทรัพย์", account_type: "bank" }];
const context = {
  today,
  suggestedNumber: "INV-2569-017",
  clients: [],
  accounts,
  defaultReceiveAccountId: accounts[0].id,
};
const renderChrome = (children: string) => {
  const props = { title: "Money", children };
  return renderToStaticMarkup(createElement(MoneyChrome, props));
};
const action = vi.fn(async () => ({ success: true, id: invoice.id }));
const paid = vi.fn(async () => ({
  success: true as const,
  transactionId: "tx",
  setAsideSuggestion: { amountCents: 135800, ratePct: 7, mode: "ask" as const },
}));
describe("invoice screen static contracts", () => {
  it("list shows summary, overdue strip, pills, draft/sent/overdue chips and safe-area creation", () => {
    const html = renderToStaticMarkup(
      createElement(InvoiceListScreen, {
        copy,
        today,
        invoices: [
          invoice,
          { ...invoice, id: "draft", status: "draft", displayStatus: "draft" },
          { ...invoice, id: "sent", displayStatus: "sent", dueDate: "2026-10-28", daysOverdue: 0 },
        ],
      }),
    );
    for (const text of [
      "ใบแจ้งหนี้",
      "19 ต.ค. 2569",
      "รอรับเงินทั้งหมด",
      "฿38,800",
      "จาก 2 ใบ",
      "เกินกำหนด 1 ใบ",
      "ยังไม่จ่าย",
      "เกินกำหนด",
      "จ่ายแล้ว",
      "ฉบับร่าง",
      "ส่งแล้ว",
      "เกิน 14 วัน",
      "อีก 9 วัน",
      'href="/money/invoices/new"',
      "safe-area-inset-bottom",
    ])
      expect(html).toContain(text);
    expect(html).toContain(`href="/money/invoices/${invoice.id}"`);
  });
  it("list hides zero overdue and distinguishes empty from failed reads", () => {
    const html = renderToStaticMarkup(createElement(InvoiceListScreen, { copy, today, invoices: [] }));
    expect(html).toContain(copy.emptyFirst);
    expect(html).not.toContain("⚠ เกินกำหนด 0 ใบ");
    const failed = renderToStaticMarkup(
      createElement(InvoiceListScreen, { copy, today, invoices: [], error: "migration 0047" }),
    );
    expect(failed).toContain('role="alert"');
    expect(failed).toContain("migration 0047");
    expect(failed).not.toContain(copy.emptyFirst);
  });
  it.each(["overdue", "paid"] as const)("shows friendly %s empty tab", (initialTab) => {
    const html = renderToStaticMarkup(
      createElement(InvoiceListScreen, {
        copy,
        today,
        invoices: [{ ...invoice, status: "draft", displayStatus: "draft" }],
        initialTab,
      }),
    );
    expect(html).toContain(copy.emptyTabs[initialTab]);
  });
  it.each(["draft", "sent", "paid", "void"] as const)(
    "detail %s has the correct action set and only two share options",
    (status) => {
      const html = renderToStaticMarkup(
        createElement(InvoiceDetailScreen, {
          copy,
          invoice: { ...invoice, status, displayStatus: status, paidAt: status === "paid" ? today : null },
          today,
          accounts,
          onMarkSent: action,
          onVoid: action,
          onPaid: paid,
        }),
      );
      expect(html).not.toMatch(/PDF|ลิงก์|public/);
      expect(html.includes(copy.copy)).toBe(status !== "void");
      expect(html.includes(">LINE<")).toBe(status !== "void");
      expect(html.includes(copy.received)).toBe(status === "draft" || status === "sent");
      expect(html.includes(`href="/money/invoices/${invoice.id}/edit"`)).toBe(status === "draft" || status === "sent");
      expect(html.includes(`href="/money/invoices/${invoice.id}/remind"`)).toBe(status === "sent");
      if (status === "paid") {
        expect(html).toContain("จ่ายแล้ว 19 ต.ค. 2569");
        expect(html).not.toContain(copy.voidAction);
      }
    },
  );
  it("detail includes totals, paper metadata and share highlight", () => {
    const html = renderToStaticMarkup(
      createElement(InvoiceDetailScreen, {
        copy,
        invoice,
        today,
        accounts,
        highlightShare: true,
        onMarkSent: action,
        onVoid: action,
        onPaid: paid,
      }),
    );
    for (const text of ["ถึง", "เครดิตภาษี", "฿19,400", "SCB", "หมายเหตุ", copy.shareHint])
      expect(html).toContain(text);
    expect(html).toContain('<p role="status" aria-live="polite" class="sr-only">');
  });
  it("shared Thai date field displays Buddhist date while preserving the native picker and maximum", () => {
    const html = renderToStaticMarkup(
      createElement(ThaiDateField, {
        "aria-label": copy.paidDate,
        value: today,
        max: today,
        onChange: vi.fn(),
      }),
    );
    expect(html).toContain("19 ต.ค. 2569");
    expect(html).toContain(`aria-label="${copy.paidDate}"`);
    expect(html).toContain('type="date"');
    expect(html).toContain(`value="${today}"`);
    expect(html).toContain(`max="${today}"`);
    expect(html).toContain("opacity-0");
    expect(html).toContain("focus-within:ring-1");
  });
  it("clipboard failure keeps the invoice text visible and selectable", () => {
    const html = renderToStaticMarkup(createElement(CopyFallback, { text: "Invoice text to copy", copy }));
    expect(html).toContain(copy.copyFallback);
    expect(html).toContain("<textarea");
    expect(html).toContain('readOnly=""');
    expect(html).toContain("Invoice text to copy");
    expect(html).not.toContain("sr-only");
  });
  it.each(["polite", "friendly", "firm"] as const)(
    "reminder %s exposes three tones, editable text, endings and share buttons",
    (initialTone) => {
      const html = renderToStaticMarkup(createElement(InvoiceReminderScreen, { copy, invoice, today, initialTone }));
      for (const text of [
        "ตามเงิน",
        "เกิน 14 วัน",
        "สุภาพ",
        "เป็นกันเอง",
        "จริงจัง",
        "<textarea",
        "ค่ะ",
        "ครับ",
        copy.sendLine,
        copy.copy,
        "ฝ่ายบัญชี Studio Mango",
      ])
        expect(html).toContain(text);
      expect(html).not.toContain("ถ้าไม่ตอบ");
      expect(html).not.toContain("เตือนฉันอีกครั้ง");
    },
  );
  it("create initializes 15-day due date, invoice number, WHT suggestion, editable items and accounts", () => {
    const html = renderToStaticMarkup(
      createElement(InvoiceFormScreen, { copy, context, onSave: action, onMarkSent: action }),
    );
    for (const text of [
      copy.newTitle,
      "INV-2569-017",
      'value="2026-11-03"',
      "3 พ.ย. 2569",
      "19 ต.ค. 2569",
      "+15 วัน",
      copy.automatic,
      copy.recommended,
      'value="0" selected',
      copy.saveSend,
      copy.saveDraft,
      "SCB",
      'role="combobox"',
    ])
      expect(html).toContain(text);
  });
  it("edit preserves dates, WHT, items and number", () => {
    const html = renderToStaticMarkup(
      createElement(InvoiceFormScreen, { copy, context, invoice, onSave: action, onMarkSent: action }),
    );
    expect(html).toContain(copy.editTitle);
    expect(html).not.toContain(copy.automatic);
    expect(html).toContain('value="2026-10-05"');
    expect(html).toContain("ออกแบบโลโก้");
    expect(html).toContain(copy.saveEdit);
    expect(html).not.toContain(copy.saveDraft);
  });
  it("English labels have real translations", () => {
    const html = renderToStaticMarkup(
      createElement(InvoiceListScreen, { copy: en.invoiceUi, locale: "en", today, invoices: [] }),
    );
    expect(html).toContain("Total receivables");
    expect(html).toContain("Create your first invoice");
  });
  it("Money chrome hides on invoice paths and remains on siblings", () => {
    for (const path of ["/money/invoices", "/money/invoices/new", `/money/invoices/${invoice.id}/edit`]) {
      pathname = path;
      const html = renderChrome("invoice-screen");
      expect(html).toContain("invoice-screen");
      expect(html).not.toContain("money-tabs");
      expect(html).not.toContain("Money");
    }
    pathname = "/money/accounts";
    expect(renderChrome("accounts")).toContain("money-tabs");
  });
  it("form and detail both preselect an only account without a supplied default", () => {
    const unassigned = { ...invoice, receiveAccountId: null, receiveAccountName: null };
    const html = renderToStaticMarkup(createElement(InvoiceFormScreen, {
      copy, context: { ...context, defaultReceiveAccountId: null },
      invoice: unassigned, onSave: action, onMarkSent: action,
    }));
    expect(html).toContain(`value="${accounts[0].id}" selected=""`);
    const detail = renderToStaticMarkup(createElement(InvoiceDetailScreen, {
      copy, today, invoice: unassigned, accounts, onPaid: paid, onVoid: action, onMarkSent: action,
    }));
    expect(detail).toContain(accounts[0].name);
  });
  it("unavailable editable accounts stay unselected; paid history retains its account name", () => {
    const props = { copy, today, accounts: [], onPaid: paid, onVoid: action, onMarkSent: action };
    const editable = renderToStaticMarkup(createElement(InvoiceDetailScreen, { ...props, invoice }));
    expect(editable).not.toContain(invoice.receiveAccountName!);
    expect(editable).toContain(copy.chooseAccount);
    const history = renderToStaticMarkup(createElement(InvoiceDetailScreen, {
      ...props, invoice: { ...invoice, status: "paid", displayStatus: "paid", paidAt: today },
    }));
    expect(history).toContain(invoice.receiveAccountName!);
  });
  it("routes guard data with privacy and await promised route parameters", () => {
    const route = readFileSync("src/features/invoices/route-screen.tsx", "utf8");
    expect(route.indexOf('await getPrivacyGate("activity")')).toBeLessThan(route.indexOf("await listInvoices(today)"));
    for (const path of ["[id]", "[id]/edit", "[id]/remind"])
      expect(readFileSync(`src/app/(app)/money/invoices/${path}/page.tsx`, "utf8")).toContain("await params");
  });
});
