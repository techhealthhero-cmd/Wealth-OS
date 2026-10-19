import th from "@/i18n/locales/th.json";
import en from "@/i18n/locales/en.json";
import { describe, expect, it } from "vitest";
import {
  buildInvoiceShareText,
  buildLineShareUrl,
  buildReminderText,
  calendarDaysBetween,
  invoiceMoney,
  defaultDueDate,
  filterByTab,
  filterClientSuggestions,
  formatThaiDate,
  groupClientSuggestions,
  invoiceTab,
  invoiceTabCounts,
  shortThaiDate,
  suggestWithholdingRate,
  type InvoiceView,
} from "@/features/invoices/ui-logic";

import { invoice } from "./fixtures/invoice-ui";

describe("invoice calendar dates", () => {
  it.each([
    ["2026-10-19", "2026-11-03"],
    ["2026-12-25", "2027-01-09"],
    ["2024-02-20", "2024-03-06"],
    ["2023-02-20", "2023-03-07"],
    ["2024-02-14", "2024-02-29"],
  ])("adds 15 calendar days to %s", (from, to) => expect(defaultDueDate(from)).toBe(to));
  it("computes signed calendar differences and preserves fractional money", () => {
    expect(calendarDaysBetween("2026-10-19", "2026-11-03")).toBe(15);
    expect(calendarDaysBetween("2026-10-19", "2026-10-05")).toBe(-14);
    expect(invoiceMoney(1940050)).toBe("฿19,400.50");
  });
  it.each(["2026-02-30", "invalid", "2026-1-01"])("rejects invalid dates %s", (value) =>
    expect(() => defaultDueDate(value)).toThrow(),
  );
  it("formats Thai short dates and Buddhist years without depending on timezone", () => {
    expect(shortThaiDate("2026-10-05")).toBe("5 ต.ค.");
    expect(formatThaiDate("2026-10-19")).toBe("19 ต.ค. 2569");
  });
});
describe("withholding suggestions", () => {
  it.each([0, 1, 2, 3, 5] as const)("preserves a known client's %s%% even for individuals", (rate) =>
    expect(suggestWithholdingRate({ clientIsCompany: false, previousRatePct: rate })).toEqual({
      ratePct: rate,
      reason: "previous",
    }),
  );
  it("prefers previous zero over company default", () =>
    expect(suggestWithholdingRate({ clientIsCompany: true, previousRatePct: 0 }).ratePct).toBe(0));
  it("suggests 3 for company and 0 for individual", () => {
    expect(suggestWithholdingRate({ clientIsCompany: true })).toEqual({ ratePct: 3, reason: "company" });
    expect(suggestWithholdingRate({ clientIsCompany: false })).toEqual({ ratePct: 0, reason: "individual" });
  });
});
describe("client history", () => {
  const base = {
    clientIsCompany: true,
    withholdingRatePct: 3 as const,
    netReceivableCents: 9700,
    subtotalCents: 10000,
    issueDate: "2026-10-01",
  };
  const rows = [
    { ...base, clientName: " studio   MANGO ", createdAt: "2026-10-02", withholdingRatePct: 1 as const },
    { ...base, clientName: "Studio Mango", createdAt: "2026-10-01" },
    { ...base, clientName: "คุณมีนา", createdAt: "2026-10-03" },
    { ...base, clientName: " ", createdAt: "2026-10-04" },
  ];
  it("deduplicates case and repeated spaces, most recent wins, leaves input intact", () => {
    const result = groupClientSuggestions(rows);
    expect(result.map((r) => r.clientName)).toEqual(["คุณมีนา", "studio   MANGO"]);
    expect(result[1].withholdingRatePct).toBe(1);
    expect(rows[0].clientName).toBe(" studio   MANGO ");
  });
  it("filters trimmed Thai and English contains", () => {
    const result = groupClientSuggestions(rows);
    expect(filterClientSuggestions(result, "  MANGO ")).toHaveLength(1);
    expect(filterClientSuggestions(result, "มีน")[0].clientName).toBe("คุณมีนา");
    expect(filterClientSuggestions(result, " ")).toHaveLength(2);
  });
});
describe("tabs, ordering and counts", () => {
  const rows: InvoiceView[] = [
    { ...invoice, id: "draft", status: "draft", displayStatus: "draft", daysOverdue: 0 },
    { ...invoice, id: "sent-later", displayStatus: "sent", dueDate: "2026-11-01", daysOverdue: 0 },
    { ...invoice, id: "paid-old", status: "paid", displayStatus: "paid", paidAt: "2026-10-01" },
    { ...invoice, id: "void", status: "void", displayStatus: "void" },
    { ...invoice, id: "overdue-7", daysOverdue: 7 },
    { ...invoice, id: "overdue-14" },
    { ...invoice, id: "sent-sooner", displayStatus: "sent", dueDate: "2026-10-25", daysOverdue: 0 },
    { ...invoice, id: "paid-new", status: "paid", displayStatus: "paid", paidAt: "2026-10-18" },
  ];
  it("sorts overdue, sent, drafts; hidden void; paid newest first", () => {
    expect(filterByTab(rows, "unpaid").map((r) => r.id)).toEqual([
      "overdue-14",
      "overdue-7",
      "sent-sooner",
      "sent-later",
      "draft",
    ]);
    expect(filterByTab(rows, "overdue").map((r) => r.id)).toEqual(["overdue-14", "overdue-7"]);
    expect(filterByTab(rows, "paid").map((r) => r.id)).toEqual(["paid-new", "paid-old"]);
    expect(rows[0].id).toBe("draft");
  });
  it("counts overdue within unpaid and hides void everywhere", () => {
    expect(invoiceTab("overdue")).toBe("unpaid");
    expect(invoiceTab("void")).toBeNull();
    expect(invoiceTabCounts(rows)).toEqual({ unpaid: 5, overdue: 2, paid: 2 });
  });
});
describe("sharing", () => {
  it("contains invoice, item lines, calculated subtotal, withholding, net, due, account and notes; no URLs", () => {
    const text = buildInvoiceShareText(invoice, { copy: th.invoiceUi, locale: "th" });
    for (const value of [
      "INV-2569-017",
      "Studio Mango",
      "ออกแบบโลโก้",
      "2.5 × ฿2,000 = ฿5,000",
      "฿20,000",
      "หัก ณ ที่จ่าย 3%",
      "฿600",
      "ยอดที่ต้องโอน ฿19,400",
      "5 ต.ค. 2569",
      "SCB",
      invoice.notes!,
    ])
      expect(text).toContain(value);
    expect(text).not.toMatch(/https?:\/\//);
  });
  it("omits zero withholding and absent optional fields", () => {
    const text = buildInvoiceShareText(
      { ...invoice, withholdingRatePct: 0, notes: null, receiveAccountName: null },
      { copy: th.invoiceUi },
    );
    expect(text).not.toContain("หัก ณ ที่จ่าย");
    expect(text).not.toContain("SCB");
    expect(text).toContain("฿20,000");
  });
  it("translates invoice sharing", () =>
    expect(buildInvoiceShareText(invoice, { copy: en.invoiceUi, locale: "en" })).toContain("Amount to transfer"));
  it("uses injected copy for sharing and reminders", () => {
    const copy = {
      ...th.invoiceUi,
      shareGreeting: "Custom greeting",
      reminderTemplates: { ...th.invoiceUi.reminderTemplates, polite: "Custom {number} {ending}" },
    };
    expect(buildInvoiceShareText(invoice, { copy })).toContain("Custom greeting");
    expect(buildReminderText(invoice, { copy, tone: "polite", ending: "ครับ", today: "2026-10-19" })).toBe(
      `Custom ${invoice.invoiceNumber} ครับ`,
    );
  });
  it("encodes Thai and newlines into a LINE URL", () => {
    const text = "สวัสดีค่ะ\nยอด ฿19,400 & +?";
    expect(buildLineShareUrl(text)).toBe("https://line.me/R/share?text=" + encodeURIComponent(text));
    expect(decodeURIComponent(buildLineShareUrl(text).split("text=")[1])).toBe(text);
  });
});
describe("reminders", () => {
  it.each(["polite", "friendly", "firm"] as const)("produces courteous %s text for both endings", (tone) => {
    for (const ending of ["ค่ะ", "ครับ"] as const) {
      const text = buildReminderText(invoice, { copy: th.invoiceUi, tone, ending, today: "2026-10-19" });
      for (const value of [
        "ฝ่ายบัญชี Studio Mango",
        "INV-2569-017",
        "฿19,400",
        "5 ต.ค.",
        "14 วัน",
        "สลิป",
        "ขอบคุณ",
        ending,
      ])
        expect(text).toContain(value);
      expect(text).not.toMatch(/ขู่|ปรับ|ดำเนินคดี/);
    }
  });
  it("does not mention overdue days when due today or in future", () => {
    for (const today of ["2026-10-01", "2026-10-05"])
      for (const tone of ["polite", "friendly", "firm"] as const) {
        const text = buildReminderText(invoice, { copy: th.invoiceUi, tone, ending: "ค่ะ", today });
        expect(text).not.toMatch(/เลยกำหนด|ผ่านกำหนด|เกินกำหนด/);
      }
  });
  it.each(["มีนา", "คุณมีนา"])("addresses individual %s without double คุณ", (name) => {
    const text = buildReminderText(
      { ...invoice, clientName: name, clientIsCompany: false },
      { copy: th.invoiceUi, tone: "polite", ending: "ค่ะ", today: "2026-10-19" },
    );
    expect(text).toContain("คุณมีนา");
    expect(text).not.toContain("คุณคุณ");
    expect(text).not.toContain("ฝ่ายบัญชี");
  });
  it("uses distinct tones", () => {
    const texts = ["polite", "friendly", "firm"].map((tone) =>
      buildReminderText(invoice, { copy: th.invoiceUi, tone: tone as "polite", ending: "ค่ะ", today: "2026-10-19" }),
    );
    expect(new Set(texts).size).toBe(3);
    expect(texts[0]).toContain("สะดวกโอนภายในสัปดาห์นี้ไหมคะ");
  });
});
