import { describe, expect, it } from "vitest";
import { parseCancelIntent, parseSubscriptionIntent, matchRecurringForCancel } from "@/lib/capture/subscription-intent";
import { parseCaptureText, type ParseContext } from "@/lib/capture/transaction-parser";
import { parseRecap } from "@/lib/capture/recap";
import { buildCaptureSaveInput, canSaveDraft, type CaptureDraft } from "@/lib/capture/draft";
import { mergeAIParse } from "@/lib/capture/ai-fallback";

const ctx: ParseContext = { today: "2026-10-19", accounts: [], categories: [], merchantPreferences: [] };
const item = (id: string, merchant: string | null, description: string | null = null, is_active = true) => ({ id, merchant, description, is_active });

describe("cancel subscription commands", () => {
  it.each([
    ["ยกเลิก Duolingo แล้ว", "Duolingo"], ["ยกเลิก sub Grok", "Grok"],
    ["unsubscribe Netflix", "Netflix"], ["เลิกสมัคร Spotify", "Spotify"],
    ["cancel subscription YouTube", "YouTube"], ["ยกเลิก Netflix 419", "Netflix"],
    ["ยกเลิก", ""], ["ฉันยกเลิก Duolingo แล้ว", "Duolingo"],
    ["ยกเลิกตั๋ว", "ตั๋ว"], ["ยกเลิก Duolingo 1190", "Duolingo"],
    ["เลิกสมัคร Acme 500", "Acme"], ["เลิกสมัครเรียน 500", "เรียน"],
    ["ยกเลิก sub บริการใหม่ 500", "บริการใหม่"],
    ["ยกเลิก subscription บริการใหม่ 500", "บริการใหม่"],
    ["ยกเลิกสมาชิก บริการใหม่ 500", "สมาชิก บริการใหม่"],
    ["ยกเลิกซับ บริการใหม่ 500", "บริการใหม่"],
    ["ยกเลิกสมัคร บริการใหม่ 500", "บริการใหม่"],
    ["ยกเลิก Acme รายเดือน 500", "Acme"],
    ["ยกเลิก Acme รายปี 500", "Acme"],
    ["ยกเลิก LINE MAN Plus 59", "LINE MAN Plus"],
  ])("parses %s without creating an expense", (text, serviceQuery) => {
    expect(parseCancelIntent(text)).toEqual({ serviceQuery });
    const parsed = parseCaptureText(text, ctx);
    expect(parsed.cancelIntent).toEqual({ serviceQuery });
    expect(parsed.amountCents).toBeNull();
    expect(parseRecap(text, ctx)).toHaveLength(1);
    const draft: CaptureDraft = { ...parsed, amountCents: 41900, accountId: "a", source: "voice", categoryConfirmedByUser: false };
    expect(canSaveDraft(draft)).toBe(false);
    expect(buildCaptureSaveInput(draft, crypto.randomUUID())).toBeNull();
  });
  it.each(["ค่ายกเลิกตั๋ว 200", "ค่าข้าว 50", "สมัครเรียน 500"])("keeps %s as a payment", (text) => {
    expect(parseCancelIntent(text)).toBeNull();
    expect(parseCaptureText(text, ctx).amountCents).not.toBeNull();
  });
  it.each([
    ["ยกเลิกตั๋วเครื่องบิน ได้เงินคืน 2000", 200000],
    ["ยกเลิกตั๋ว คืนเงิน 1500", 150000],
    ["ยกเลิกตั๋ว 1,500.50 บาท", 150050],
    ["ฉันยกเลิกโรงแรม 2000", 200000],
    ["ยกเลิก Suburb 1500", 150000],
  ])("keeps cancellation with an amount as a transaction: %s", (text, amountCents) => {
    expect(parseCancelIntent(text)).toBeNull();
    expect(parseSubscriptionIntent(text)).toBeNull();
    const parsed = parseCaptureText(text, ctx);
    expect(parsed.cancelIntent).toBeFalsy();
    expect(parsed.amountCents).toBe(amountCents);
  });
  it("matches substrings, spaces, casing, Thai, descriptions and a simple typo", () => {
    for (const [query, name] of [["Grok", "Grok Bot"], ["duo lingo", "Duolingo"], ["NETFLIX", "Netflix"], ["เน็ต ฟลิกซ์", "เน็ตฟลิกซ์"], ["Netflx", "Netflix"]]) {
      expect(matchRecurringForCancel(query, [item("1", name)])).toMatchObject({ status: "single", item: { id: "1" } });
    }
    expect(matchRecurringForCancel("Grok", [item("1", null, "Grok Bot")]).status).toBe("single");
  });
  it("requires a choice for ambiguous matches and ignores inactive items", () => {
    expect(matchRecurringForCancel("Grok", [item("1", "Grok Bot"), item("2", "Grok Pro"), item("3", "Grok", null, false)]))
      .toMatchObject({ status: "multiple", candidates: [{ id: "1" }, { id: "2" }] });
    expect(matchRecurringForCancel("Netflix", [item("1", "Spotify")])).toEqual({ status: "none" });
    expect(matchRecurringForCancel("", [item("1", "Grok")])).toEqual({ status: "none" });
  });
});

describe("subscription signals", () => {
  it.each(["Netflix", "Spotify", "YouTube Premium", "Disney+", "iCloud", "Google One", "ChatGPT", "Grok", "Duolingo", "Canva", "Adobe", "Apple Music", "LINE MAN Plus"])("recognizes known service %s without signup or cadence", (serviceName) => {
    expect(parseSubscriptionIntent(`${serviceName} 199`)).toEqual({ serviceName, frequency: "monthly" });
    expect(parseCancelIntent(`ยกเลิก ${serviceName} 199`)).toEqual({ serviceQuery: serviceName });
  });
  it.each(["Suburb 199", "subway 200", "Grokery 199", "Canvases 199", "สมัครเรียน 500", "สมัครงาน 100"])("does not match partial service names or excluded signup: %s", (text) => {
    expect(parseSubscriptionIntent(text)).toBeNull();
  });
  it.each([
    ["ค่าเช่าห้องเดือนละ 5000", "monthly"],
    ["ค่าโทรศัพท์รายเดือน 599", "monthly"],
    ["ค่าเน็ตต่อเดือน 650", "monthly"],
    ["ประกันรายปี 1190", "yearly"],
  ])("retains recurring metadata for %s", (text, frequency) => {
    expect(parseSubscriptionIntent(text)).toMatchObject({ frequency });
  });
});

describe("subscription drafts", () => {
  const subscription = { serviceName: "Grok Bot", frequency: "monthly" as const };
  const draft: CaptureDraft = { type: "expense", amountCents: 107900, accountId: "account", categoryId: null, categorySource: "keyword", merchant: "Grok Bot", description: "Grok Bot", date: ctx.today, confidence: "high", source: "voice", categoryConfirmedByUser: false, subscription };
  it("defaults to recurring ON; respects opt-out and explicit account choice", () => {
    expect(buildCaptureSaveInput(draft, crypto.randomUUID())?.recurring).toEqual({ frequency: "monthly", name: "Grok Bot" });
    expect(buildCaptureSaveInput({ ...draft, addRecurring: false }, crypto.randomUUID())?.recurring).toBeUndefined();
    expect(buildCaptureSaveInput({ ...draft, subscriptionAccountMissing: true }, crypto.randomUUID())).toBeNull();
    expect(buildCaptureSaveInput({ ...draft, subscriptionAccountMissing: false }, crypto.randomUUID())).not.toBeNull();
  });
  it("AI cannot overwrite deterministic subscription or cancellation intent", () => {
    for (const text of ["sub Grok Bot 1079", "ยกเลิก Grok 1079"]) {
      const parsed = parseCaptureText(text, ctx);
      expect(mergeAIParse(text, parsed, { type: "income", amountCents: 1, merchant: "wrong", description: null, date: null, categoryId: null, payment: null, confidence: "high" }, ctx)).toBe(parsed);
    }
  });
});
