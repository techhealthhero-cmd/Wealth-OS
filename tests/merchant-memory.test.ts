import { describe, expect, it } from "vitest";
import { createMerchantMemory, extractMemoryKey, lookupMemory, MEMORY_CAP, MEMORY_KEY, normalizeMemoryText, type MerchantMemoryEntry } from "@/lib/capture/merchant-memory";
import { parseCaptureText, suggestCategory, type ParseContext } from "@/lib/capture/transaction-parser";
import { evaluateCaptureConfidence } from "@/lib/capture/confidence";
import fixture from "./fixtures/nlp/capture-corpus.v1.json";
const context = fixture.context as ParseContext;
function storage() {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } };
}
const observation = { text: "จ่าย zorbix 100 บาท", categoryId: "food", direction: "expense" as const, source: "correction" as const };
const entry = (key: string, categoryId = "food", direction: "income" | "expense" = "expense"): MerchantMemoryEntry => ({ key, counts: [{ categoryId, direction, count: 1, weight: 3 }], lastUsed: 1, source: "correction" });
describe("device merchant memory", () => {
  it("is safe with no window and no identity", () => {
    expect(typeof window).toBe("undefined");
    const repo = createMerchantMemory("user");
    repo.learn(observation); expect(repo.load()).toEqual([]); repo.clear(); repo.forget("x");
    const local = storage(); createMerchantMemory(null, () => local).learn(observation); expect(local.data.size).toBe(0);
  });
  it("persists versioned data, isolates accounts and clears only its own bucket", () => {
    const local = storage(); const a = createMerchantMemory("a", () => local); const b = createMerchantMemory("b", () => local);
    a.learn(observation); expect(createMerchantMemory("a", () => local).lookup("ZORBIX 200")?.categoryId).toBe("food");
    expect(b.load()).toEqual([]); b.learn(observation); a.clear(); expect(a.load()).toEqual([]); expect(b.load()).toHaveLength(1);
    b.forget("zorbix"); expect(b.load()).toEqual([]);
  });
  it.each(["{", '{"version":0,"entries":[]}', '{"version":1,"entries":[null,{}, {"key":"123"}]}', '{"version":2,"entries":[]}'])("ignores old or corrupt storage: %s", raw => {
    const local = storage(); local.setItem(`${MEMORY_KEY}:a`, raw); expect(createMerchantMemory("a", () => local).load()).toEqual([]);
  });
  it("tolerates blocked storage", () => {
    const repo = createMerchantMemory("a", () => { throw Error("blocked"); });
    expect(repo.load()).toEqual([]); expect(() => { repo.learn(observation); repo.clear(); }).not.toThrow();
  });
  it("caps memory and evicts least recently observed entries", () => {
    const local = storage(); let tick = 0; const repo = createMerchantMemory("a", () => local, () => ++tick);
    const word = (i: number) => `merchant${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + i % 26)}`;
    for (let i = 0; i < MEMORY_CAP; i++) repo.learn({ ...observation, text: word(i) });
    repo.learn({ ...observation, text: word(0) }); repo.learn({ ...observation, text: "newmerchant" });
    expect(repo.load()).toHaveLength(MEMORY_CAP); expect(repo.lookup(word(0))).not.toBeNull(); expect(repo.lookup(word(1))).toBeNull();
  });
  it.each(["", "จ่าย ซื้อ ได้ โอน ไป มา ให้ ที่ วันนี้ เมื่อวาน เงิน ค่า", "123 ๔๕๖ ฿", "สองพันบาท", "ab", "ก", "2026/10/19"])("rejects meaningless key %s", text => {
    expect(extractMemoryKey(text)).toBeNull();
  });
  it("normalizes case, zero width, amounts, Thai number words and spacing", () => {
    expect(normalizeMemoryText(" ZOR\u200bBIX   Shop ")).toBe("zorbix shop");
    expect(extractMemoryKey("วันนี้ จ่าย Zorbix สองพันบาท")).toBe("zorbix");
  });
  it("matches substrings and prefers the longest key even when conflicting", () => {
    expect(lookupMemory("Zorbix   Studio 100", [entry("zorbix"), entry("zorbix studio", "salary", "income")])?.categoryId).toBe("salary");
    expect(lookupMemory("ร้านสมชายใหม่ 100", [entry("สมชาย")])?.categoryId).toBe("food");
  });
  it("weights corrections more, preserves conflicts and removes only an undone vote", () => {
    const local = storage(); const repo = createMerchantMemory("a", () => local);
    repo.learn({ ...observation, source: "confirm" }); repo.learn({ ...observation, categoryId: "other" });
    expect(repo.lookup("zorbix")?.categoryId).toBe("other"); expect(repo.lookup("zorbix")?.reliable).toBe(true);
    const undo = repo.learnWithUndo(observation); expect(repo.lookup("zorbix")?.reliable).toBe(false);
    undo(); expect(repo.lookup("zorbix")?.reliable).toBe(true);
  });
});
describe("memory parsing and confidence", () => {
  const parse = (text: string, deviceMemory = [entry("zorbix", "freelance", "income")]) => {
    const ctx = { ...context, deviceMemory, text }; const parsed = parseCaptureText(text, ctx);
    return { parsed, gate: evaluateCaptureConfidence(parsed, ctx) };
  };
  it("learns a correction, reloads and categorizes the repeated capture", () => {
    const local = storage(); const repo = createMerchantMemory("a", () => local);
    expect(parseCaptureText("zorbix 100 เงินสด", context).categoryId).toBe("other");
    repo.learn({ text: "zorbix 100 เงินสด", categoryId: "freelance", direction: "income", source: "correction" });
    const { parsed, gate } = parse("zorbix 200 เงินสด", createMerchantMemory("a", () => local).load());
    expect(parsed.type).toBe("income"); expect(parsed.categoryId).toBe("freelance"); expect(gate.fields.category.reliable).toBe(true); expect(gate.fields.direction.source).toBe("device_memory"); expect(gate.autoSave).toBe(true);
  });
  it("lets explicit category words beat memory", () => {
    const { parsed } = parse("zorbix ซื้อกาแฟ 100 เงินสด");
    expect(parsed.type).toBe("expense"); expect(parsed.categoryId).toBe("food"); expect(parsed.categorySource).toBe("keyword");
  });
  it.each(["zorbix เงินสด", "zorbix 100 200 เงินสด", "zorbix 100 พรุ่งนี้ เงินสด", "zorbix 100"])("still clarifies uncertain amount/date/account: %s", text => {
    expect(parse(text).gate.autoSave).toBe(false);
  });
  it("asks on conflicting merchant history", () => {
    const e = entry("shopee"); e.counts.push({ categoryId: "other", direction: "expense", count: 1, weight: 3 });
    expect(parse("shopee 100 เงินสด", [e]).gate.reasons).toContain("memory_conflict");
  });
  it.each([entry("zorbix", "missing"), entry("zorbix", "food", "income")])("ignores missing and wrong-type categories", e => {
    expect(parse("zorbix 100 เงินสด", [e]).parsed.categorySource).toBe("fallback");
  });
  it("ignores archived categories", () => {
    const ctx = { ...context, categories: context.categories.map(c => ({ ...c, is_archived: c.id === "freelance" })), deviceMemory: [entry("zorbix", "freelance", "income")] };
    expect(parseCaptureText("zorbix 100 เงินสด", ctx).type).toBe("expense");
  });
  it.each(["ลูกค้าโอนมา 2 พัน", "รับจ้างขนของ 500", "ได้ค่าแรงร้านกาแฟ 500", "สปอนเซอร์ 1000"])("recognizes freelancer income %s", text => {
    const parsed = parseCaptureText(text, context); expect(parsed.type).toBe("income"); expect(parsed.categoryId).toBe("freelance");
  });
});

import { confirmedMemoryObservation } from "@/lib/capture/capture-memory-signal";
import { createConfidenceDraft } from "@/lib/capture/draft";
import { resolveMemoryIdentity } from "@/lib/capture/capture-memory-identity";
describe("save-time memory identity", () => {
  it("uses the auth ref even when Save captured the unresolved render", async () => {
    const identity = { current: { userId: "signed-in" as string | null } };
    expect(await resolveMemoryIdentity(identity, null, async () => null)).toBe("signed-in");
  });
  it("resolves the session before learning when the listener has not fired", async () => {
    const identity = { current: { userId: null as string | null } };
    const userId = await resolveMemoryIdentity(identity, null, async () => "signed-in");
    const local = storage();
    createMerchantMemory(userId, () => local).learn(observation);
    expect(local.data.has(`${MEMORY_KEY}:signed-in`)).toBe(true);
    expect(identity.current.userId).toBe("signed-in");
  });
  it("accepts the same identity arriving from the auth listener during resolution", async () => {
    const identity = { current: { userId: null as string | null } };
    expect(await resolveMemoryIdentity(identity, null, async () => {
      identity.current = { userId: "signed-in" };
      return "signed-in";
    })).toBe("signed-in");
  });
  it.each([null, "another-user"])("rejects an auth change to %s during resolution", async next => {
    const identity = { current: { userId: null as string | null } };
    expect(await resolveMemoryIdentity(identity, null, async () => {
      identity.current = { userId: next };
      return "old-user";
    })).toBeNull();
  });
  it("rejects handlers belonging to a different signed-in account", async () => {
    expect(await resolveMemoryIdentity({ current: { userId: "new-user" } }, "old-user", async () => "new-user")).toBeNull();
  });
  it("fails closed when session resolution fails", async () => {
    expect(await resolveMemoryIdentity({ current: { userId: null } }, null, async () => { throw Error("session unavailable"); })).toBeNull();
  });
});

it.each(["fallback", "ai"] as const)("learns an explicit category choice despite a %s baseline matching the choice", source => {
  const text = "ป้าแดงตลาดนัดกซอยวัด 120 เงินสด";
  const final = createConfidenceDraft(parseCaptureText(text, context), { ...context, text });
  const signal = confirmedMemoryObservation(text, {
    ...final, categoryId: "food", categorySource: source, categoryConfirmedByUser: true,
    learningBaseline: { categoryId: "food", type: "expense" },
  }, context);
  expect(signal).toMatchObject({ categoryId: "food", source: "correction" });
  const local = storage();
  createMerchantMemory("signed-in", () => local).learn(signal!);
  const reloaded = createMerchantMemory("signed-in", () => local);
  expect(reloaded.load()[0].key).toBe("ป้าแดงตลาดนัดกซอยวัด");
  expect(reloaded.lookup("ป้าแดงตลาดนัดกซอยวัด 90 เงินสด")).toMatchObject({ categoryId: "food", reliable: true });
});

it.each([null, "ป้าแดงตลาดนัดกซอยวัด"])("legacy preference respects explicit category words with merchant %s and no device memory", merchant => {
  const ctx = { ...context, categories: [...context.categories, { id: "transport", name_en: "Transport", name_th: "เดินทาง", type: "expense" as const, icon: null, is_system: true }], deviceMemory: [], merchantPreferences: [{ merchant_normalized: "ป้าแดงตลาดนัดกซอยวัด", category_id: "other" }] };
  expect(suggestCategory("ป้าแดงตลาดนัดกซอยวัด ค่าแท็กซี่ 90 เงินสด", merchant, "expense", ctx)).toEqual({ categoryId: "transport", source: "keyword" });
  expect(suggestCategory("ป้าแดงตลาดนัดกซอยวัด 90 เงินสด", merchant, "expense", ctx)).toEqual({ categoryId: "other", source: "learned" });
});
it("retains exact legacy merchant preferences over built-in merchant defaults", () => {
  const ctx = { ...context, deviceMemory: [], merchantPreferences: [{ merchant_normalized: "shopee", category_id: "food" }] };
  expect(suggestCategory("shopee 90 เงินสด", "shopee", "expense", ctx)).toEqual({ categoryId: "food", source: "learned" });
});
describe("explicit confirmation signal", () => {
  const draft = (text: string) => createConfidenceDraft(parseCaptureText(text, context), { ...context, text });
  it("records confirmed choices and gives actual edits correction provenance", () => {
    const text = "ซื้อกาแฟ 100 เงินสด";
    const final = draft(text);
    expect(confirmedMemoryObservation(text, final, context)?.source).toBe("confirm");
    expect(confirmedMemoryObservation(text, { ...final, categoryId: "other" }, context)?.source).toBe("correction");
    expect(confirmedMemoryObservation(text, { ...final, type: "income", categoryId: "freelance" }, context)?.direction).toBe("income");
  });
  it("compares with the displayed reading, including an existing assisted reading", () => {
    const text = "zorbix 100 เงินสด";
    const final = { ...draft(text), categoryId: "food", categorySource: "ai" as const, learningBaseline: { categoryId: "food", type: "expense" as const } };
    expect(confirmedMemoryObservation(text, final, context)).toBeNull(); // direction remains unresolved
    const explicit = { ...final, learningBaseline: { categoryId: "other", type: "expense" as const } };
    expect(confirmedMemoryObservation(text, explicit, context)?.source).toBe("correction");
  });
  it.each(["ซื้อ zorbix เงินสด", "ซื้อ zorbix 100 200 เงินสด", "ซื้อ zorbix 100 พรุ่งนี้ เงินสด"])("does not learn unresolved captures: %s", text => {
    expect(confirmedMemoryObservation(text, { ...draft(text), categoryId: "food", categoryConfirmedByUser: true }, context)).toBeNull();
  });
  it("ignores cancelled, smart and unsaveable drafts", () => {
    const text = "ซื้อกาแฟ 100 เงินสด"; const final = draft(text);
    expect(confirmedMemoryObservation(text, { ...final, cancelIntent: { serviceQuery: "x" } }, context)).toBeNull();
    expect(confirmedMemoryObservation(text, { ...final, accountId: null }, context)).toBeNull();
    expect(confirmedMemoryObservation(text, { ...final, categoryId: null }, context)).toBeNull();
  });
  it("strips named dates rather than memorizing them", () => {
    expect(extractMemoryKey("วันที่แปด ตุลาคม จ่าย Zorbix 100 บาท")).toBe("zorbix");
  });
});

it("learns contiguous merchant context despite amounts, account words and date placement", () => {
  const local = storage(); const repo = createMerchantMemory("a", () => local);
  repo.learn({ ...observation, text: "วันนี้ จ่าย Zorbix Studio 100 เงินสด" });
  expect(repo.load()[0].key).toBe("zorbix studio");
  expect(repo.lookup("เมื่อวาน zorbix studio 250 เงินสด")?.reliable).toBe(true);
});
it("handles numeric convenience-store aliases and contextual marketplace keys", () => {
  const local = storage(); const repo = createMerchantMemory("a", () => local);
  repo.learn({ ...observation, text: "7-11 100 บาท" });
  expect(repo.lookup("7-eleven 200 บาท")?.reliable).toBe(true);
  expect(repo.lookup("เซเว่น 300 บาท")?.reliable).toBe(true);
  repo.learn({ ...observation, text: "shopee boxes 200", categoryId: "other" });
  repo.learn({ ...observation, text: "shopee snack 50" });
  expect(repo.lookup("shopee boxes 300")?.categoryId).toBe("other");
  expect(repo.lookup("shopee snack 90")?.categoryId).toBe("food");
});
it("keeps merchant and account spans aligned when removing both from a capture", () => {
  const text = "ซื้อ shopee 100 เงินสด"; const parsed = parseCaptureText(text, context);
  expect(parsed.amountCents).toBe(10000);
  expect(evaluateCaptureConfidence(parsed, { ...context, text }).fields.amount.reliable).toBe(true);
});

import { canSaveDraft, memoryNeedsConfirmation } from "@/lib/capture/draft";
it("requires a category choice for conflicting memory, then learns that confirmed choice", () => {
  const conflict = entry("zorbix"); conflict.counts.push({ categoryId: "other", direction: "expense", count: 1, weight: 3 });
  const ctx = { ...context, deviceMemory: [conflict] }; const text = "ซื้อ zorbix 100 เงินสด";
  const final = createConfidenceDraft(parseCaptureText(text, ctx), { ...ctx, text });
  expect(final.confidence).toBe("medium"); expect(memoryNeedsConfirmation(final)).toBe(true); expect(canSaveDraft(final)).toBe(false);
  expect(confirmedMemoryObservation(text, final, ctx)).toBeNull();
  const chosen = { ...final, categoryId: "food", categoryConfirmedByUser: true };
  expect(canSaveDraft(chosen)).toBe(true); expect(confirmedMemoryObservation(text, chosen, ctx)?.source).toBe("correction");
});
it("does not let a server merchant preference mask explicit category words when device memory matches", () => {
  const ctx = { ...context, deviceMemory: [entry("shopee", "other")], merchantPreferences: [{ merchant_normalized: "shopee", category_id: "other" }] };
  expect(parseCaptureText("ซื้อกาแฟ shopee 100 เงินสด", ctx).categoryId).toBe("food");
});
it("removes user account names before extracting a short merchant key", () => {
  const text = "ซื้อ โจ 100 KBank"; const final = createConfidenceDraft(parseCaptureText(text, context), { ...context, text });
  const signal = confirmedMemoryObservation(text, { ...final, categoryId: "food", categoryConfirmedByUser: true }, context);
  expect(signal).not.toBeNull(); expect(extractMemoryKey(signal!.text)).toBeNull();
});
it.each(["ค่าส่ง Flash 80", "ถุงไปรษณีย์ 100", "ค่าตัดต่อจ้างน้อง 500"])("retains existing work-support dictionary coverage: %s", text => {
  const ctx = { ...context, categories: [...context.categories, { id: "work", name_en: "Work Support", name_th: "งาน", type: "expense" as const, icon: null, is_system: true }] };
  expect(parseCaptureText(text, ctx).categoryId).toBe("work");
});
it("preserves explicit expense direction against income memory", () => {
  const ctx = { ...context, deviceMemory: [entry("zorbix", "freelance", "income")] };
  expect(parseCaptureText("จ่าย zorbix 100 เงินสด", ctx).type).toBe("expense");
});


it.each(["มาม่า", "สองแถว", "ห้างเซ็นทรัล", "ที่จอดรถ", "ได้ค่าแรง"])("preserves meaningful Thai item spans: %s", key => {
  expect(extractMemoryKey(`ซื้อ ${key} 500 บาท`)).toBe(key);
});
it.each(["ม่", "ม่า", "โจ", "ก่ข้"])("rejects keys with fewer than three base letters: %s", text => {
  expect(extractMemoryKey(text)).toBeNull();
});
it("does not match curtains with a noodle rule", () => {
  const local = storage(); const persistent = createMerchantMemory("a", () => local);
  persistent.learn({ ...observation, text: "มาม่า 50" });
  expect(persistent.lookup("ม่าน 500")).toBeNull();
});
it("makes one correction reliable after five confirms and restores the exact snapshot on undo", () => {
  const local = storage(); let tick = 100; const repo = createMerchantMemory("a", () => local, () => ++tick);
  for (let i = 0; i < 5; i++) repo.learn({ ...observation, source: "confirm" });
  const before = repo.load();
  const undo = repo.learnWithUndo({ ...observation, categoryId: "freelance", direction: "income" });
  expect(repo.lookup("zorbix 200")).toMatchObject({ categoryId: "freelance", reliable: true });
  const ctx = { ...context, deviceMemory: repo.load() };
  expect(parseCaptureText("zorbix 200 เงินสด", ctx)).toMatchObject({ categoryId: "freelance", type: "income" });
  undo(); expect(repo.load()).toEqual(before); undo(); expect(repo.load()).toEqual(before);
});
it("asks when explicit corrections alternate A to B to A", () => {
  const local = storage(); const repo = createMerchantMemory("a", () => local);
  repo.learn(observation); repo.learn({ ...observation, categoryId: "other" }); repo.learn(observation);
  expect(repo.lookup("zorbix")?.reliable).toBe(false);
  const ctx = { ...context, deviceMemory: repo.load(), text: "ซื้อ zorbix 200 เงินสด" };
  expect(evaluateCaptureConfidence(parseCaptureText(ctx.text, ctx), ctx).reasons).toContain("memory_conflict");
});
it.each(["clear", "forget", "evict", "replace"])("does not resurrect stale data after %s", action => {
  const local = storage(); let tick = 1; const repo = createMerchantMemory("a", () => local, () => ++tick);
  repo.learn(observation);
  const undo = repo.learnWithUndo({ ...observation, categoryId: "other" });
  if (action === "clear") repo.clear();
  if (action === "forget") repo.forget("zorbix");
  if (action === "evict") for (let i = 0; i < MEMORY_CAP; i++) repo.learn({ ...observation, text: `merchant${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + i % 26)}` });
  if (action === "replace") { repo.clear(); repo.learn(observation); }
  const before = repo.load(); undo(); expect(repo.load()).toEqual(before);
});
it.each(["ลูกค้าโอน 900", "รับจ้างออกแบบ 600", "รับค่าแรงก่อสร้าง 700", "ได้ค่าแรงสวน 400"])("generalizes freelancer income: %s", text => {
  expect(parseCaptureText(text, context)).toMatchObject({ categoryId: "freelance", type: "income" });
});
it("keeps paid wages as an expense", () => {
  expect(parseCaptureText("จ่ายค่าแรงช่าง 800", context).type).toBe("expense");
});

it.each(["zorbix สอง500", "zorbix 2 พัน", "zorbix ห้าร้อยบาท", "zorbix ฿สอง", "zorbix สองk"])("strips contextual amount words: %s", text => {
  expect(extractMemoryKey(text)).toBe("zorbix");
});
const qaContext: ParseContext = { ...context, categories: [...context.categories,
  { id: "work", name_en: "Work Support", name_th: "สนับสนุนการทำงาน", type: "expense", icon: null, is_system: true },
] };
it.each([
  ["ค่าส่ง Flash 45", "work", "expense", 4500],
  ["ถุงไปรษณีย์ 30", "work", "expense", 3000],
  ["ลูกค้าโอนมา 2 พัน", "freelance", "income", 200000],
  ["สปอนเซอร์ 5000", "freelance", "income", 500000],
  ["ค่าตัดต่อจ้างน้อง 800", "work", "expense", 80000],
  ["รับจ้างขนของ 500", "freelance", "income", 50000],
  ["ได้ค่าแรงร้านกาแฟ 400", "freelance", "income", 40000],
])("covers issue-8 phrase %s", (text, categoryId, type, amountCents) => {
  expect(parseCaptureText(text as string, qaContext)).toMatchObject({ categoryId, type, amountCents });
});
it.each(["บัตรเครดิตขั้นต่ำ 1500", "เก็บเงินสำรองฉุกเฉิน 1000"])("requires clarification for financial movement: %s", text => {
  const parsed = parseCaptureText(text, qaContext);
  const gate = evaluateCaptureConfidence(parsed, { ...qaContext, text });
  expect(gate.autoSave).toBe(false);
  expect(gate.reasons).toContain("ambiguous_direction");
});

it("unwinds shared-key batch saves in reverse order", () => {
  const local = storage(); const repo = createMerchantMemory("a", () => local);
  repo.learn(observation); const before = repo.load();
  const first = repo.learnWithUndo({ ...observation, categoryId: "other" });
  const second = repo.learnWithUndo(observation);
  second(); first(); expect(repo.load()).toEqual(before);
});
