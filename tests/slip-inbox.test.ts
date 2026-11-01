import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeDb, type Row } from "./mocks/fake-db";
import {
  CAPTURE_TOKEN_PREFIX,
  accountForSlipBank,
  captureTokenHint,
  defaultSlipAccountId,
  findPossibleDuplicate,
  generateCaptureToken,
  isWellFormedCaptureToken,
  readBearerToken,
  samePayer,
  sha256Hex,
  slipPayer,
  slipStatusFor,
  suggestSlipFields,
} from "@/lib/capture/slip-inbox";
import {
  EMPTY_EXTRACTION,
  normalizeReceiptModelOutput,
  payerAccountDigits,
  type ReceiptExtraction,
} from "@/lib/capture/receipt-normalize";
import type { ParseContext } from "@/lib/capture/transaction-parser";

/**
 * Slip inbox (migration 0046): pure rules, the ingest pipeline, the iPhone
 * Shortcut endpoint and confirm/dismiss — all against an in-memory fake,
 * never a real database. The AI model is a fake provider returning fixed
 * JSON, so nothing is sent anywhere.
 */

let db: FakeDb;
let currentUser: { id: string } | null;
let modelReply: string;
let modelCalls: number;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
    from: (table: string) => db.from(table),
    rpc: () => db.rpc(),
  }),
  getAuthUser: async () => currentUser,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => db }));
vi.mock("@/features/profile/queries", () => ({ getProfile: async () => null }));
vi.mock("@/i18n/server", () => ({ getLocale: async () => "en" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/observability", () => ({ captureError: vi.fn() }));

const { __setProviderForTesting } = await import("@/features/ai/lib/provider");
const { ingestSlipImage } = await import("@/features/slip-inbox/ingest");
const { confirmSlip, createCaptureToken, dismissSlip, revokeCaptureToken, uploadSlipImage } = await import(
  "@/features/slip-inbox/actions"
);
const route = await import("@/app/api/capture/slips/route");

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const KBANK = "11111111-1111-4111-8111-111111111111";
const CASH = "11111111-1111-4111-8111-222222222222";
const B_ACCOUNT = "11111111-1111-4111-8111-333333333333";
const FOOD = "22222222-2222-4222-8222-222222222222";
const OTHER = "22222222-2222-4222-8222-999999999999";
const TODAY = "2026-10-26";

const slipJson = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    is_payment_document: true,
    amount: 249,
    date: "2026-10-25",
    time: "12:30",
    merchant: "KFC",
    payment_method: "K PLUS",
    reference: "REF-0001",
    confidence: "high",
    ...over,
  });

function seed() {
  db = new FakeDb();
  db.tables.accounts = [
    { id: KBANK, user_id: USER_A, name: "Main", account_type: "bank", institution: "KBank", is_archived: false },
    { id: CASH, user_id: USER_A, name: "Cash", account_type: "cash", institution: null, is_archived: false },
    { id: B_ACCOUNT, user_id: USER_B, name: "B bank", account_type: "bank", institution: "KBank", is_archived: false },
  ];
  // Cash listed first: the KBank pick must come from the slip, not the default.
  db.tables.accounts.sort((a) => (a.id === CASH ? -1 : 1));
  db.tables.categories = [
    { id: FOOD, user_id: null, name_th: "อาหาร", name_en: "Food & Dining", type: "expense", icon: null, is_system: true },
    { id: OTHER, user_id: null, name_th: "อื่นๆ", name_en: "Other", type: "expense", icon: null, is_system: true },
  ];
  db.tables.merchant_category_preferences = [
    { user_id: USER_A, merchant_normalized: "kfc", category_id: FOOD, usage_count: 3 },
    // Another user's learning must never leak into user A's suggestion.
    { user_id: USER_B, merchant_normalized: "noodle shop", category_id: FOOD, usage_count: 9 },
  ];
  db.tables.transactions = [];
  db.tables.slip_inbox = [];
  db.tables.ai_usage_log = [];
  db.tables.subscriptions = [];
  db.tables.capture_tokens = [];
  db.tables.account_aliases = [];
  db.tables.profiles = [{ user_id: USER_A, timezone: "Asia/Bangkok", preferred_language: "th" }];
}

const image = (seedByte: number) => ({ bytes: new Uint8Array([0xff, 0xd8, seedByte, 1, 2, 3]), mediaType: "image/jpeg" as const });

beforeEach(() => {
  seed();
  currentUser = { id: USER_A };
  modelReply = slipJson();
  modelCalls = 0;
  delete process.env.CAPTURE_OCR_MOCK;
  __setProviderForTesting({
    name: "fake",
    model: "fake-model",
    generate: async () => {
      modelCalls++;
      return { content: modelReply, usage: { inputTokens: 10, outputTokens: 5 }, model: "fake-model" };
    },
    stream: async function* () {
      return { content: "", usage: { inputTokens: 0, outputTokens: 0 }, model: "fake-model" };
    },
  });
});

afterEach(() => __setProviderForTesting(undefined));

// ---------------------------------------------------------------------------

describe("capture tokens (pure)", () => {
  it("generates distinct, well-formed keys and reads them back from a Bearer header", () => {
    const a = generateCaptureToken();
    const b = generateCaptureToken();
    expect(a).not.toBe(b);
    expect(a.startsWith(CAPTURE_TOKEN_PREFIX)).toBe(true);
    expect(isWellFormedCaptureToken(a)).toBe(true);
    expect(readBearerToken(`Bearer ${a}`)).toBe(a);
    expect(readBearerToken(`bearer  ${a} `)).toBe(a);
    expect(captureTokenHint(a)).toBe(a.slice(-4));
    expect(sha256Hex(a)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects anything that isn't one of our keys", () => {
    expect(readBearerToken(null)).toBeNull();
    expect(readBearerToken("Bearer ")).toBeNull();
    expect(readBearerToken("Basic abc")).toBeNull();
    expect(readBearerToken(`Bearer ${CAPTURE_TOKEN_PREFIX}short`)).toBeNull();
    expect(readBearerToken("Bearer sk-ant-something-else-entirely-0000000000000000")).toBeNull();
  });
});

describe("slip suggestions (pure)", () => {
  const ctx: ParseContext = {
    accounts: [
      { id: CASH, name: "Cash", account_type: "cash", institution: null, is_archived: false },
      { id: KBANK, name: "Main", account_type: "bank", institution: "KBank", is_archived: false },
    ],
    categories: [
      { id: FOOD, name_th: "อาหาร", name_en: "Food & Dining", type: "expense", icon: null, is_system: true },
      { id: OTHER, name_th: "อื่นๆ", name_en: "Other", type: "expense", icon: null, is_system: true },
    ],
    merchantPreferences: [{ merchant_normalized: "kfc", category_id: FOOD }],
    today: TODAY,
  };
  const slip = (over: Partial<ReceiptExtraction>): ReceiptExtraction => ({
    ...EMPTY_EXTRACTION,
    isPaymentDocument: true,
    amountCents: 24900,
    merchant: "KFC",
    paymentMethod: "K PLUS",
    confidence: "high",
    ...over,
  });

  it("picks the paying bank from the slip and the learned category", () => {
    expect(suggestSlipFields(slip({}), ctx)).toEqual({ accountId: KBANK, categoryId: FOOD, confidence: "high" });
  });

  it("falls back to an everyday account (bank before cash), and a blind 'Other' never stays high", () => {
    expect(suggestSlipFields(slip({ merchant: "Somchai Jaidee", paymentMethod: null }), ctx)).toEqual({
      accountId: KBANK,
      categoryId: OTHER,
      confidence: "medium",
    });
  });

  it("never guesses an emergency/savings account — no everyday account means the user picks", () => {
    const emergency = { id: "e1", name: "เงินกันจน (ฉุกเฉิน) 10", account_type: "bank" as const, institution: null, is_archived: false };
    const savings = { id: "s1", name: "Dream", account_type: "savings" as const, institution: null, is_archived: false };
    const daily = { id: "d1", name: "ใช้จ่ายรายวัน", account_type: "bank" as const, institution: null, is_archived: false };
    expect(defaultSlipAccountId([emergency, savings, daily])).toBe("d1");
    expect(defaultSlipAccountId([emergency, savings])).toBeNull();
    const none = suggestSlipFields(slip({ paymentMethod: "K PLUS" }), { ...ctx, accounts: [emergency, savings] });
    expect(none.accountId).toBeNull();
  });

  it("several 'jar' accounts at the paying bank: no guess — the user picks (found live)", () => {
    const jar = (id: string, name: string, account_type: "bank" | "cash" = "bank") => ({
      id,
      name,
      account_type,
      institution: "กสิกร",
      is_archived: false,
    });
    const accounts = [
      jar("cash", "Cash", "cash"),
      jar("grow", "เงินพาโต (ลงทุน) 10"),
      jar("emer", "เงินกันจน (ฉุกเฉิน) 10"),
      jar("skill", "เพิ่มสกิล/รายได้ 10"),
      jar("subs", "Subscription รายเดือน"),
    ];
    expect(accountForSlipBank("KBank", accounts)).toBe("ambiguous");
    expect(suggestSlipFields(slip({ paymentMethod: "KBank", payerAccount: "8710" }), { ...ctx, accounts }).accountId).toBeNull();
    // Only one everyday account at the bank (the rest set aside) → that one.
    expect(accountForSlipBank("K PLUS", [jar("cash", "Cash", "cash"), jar("emer", "เงินกันจน (ฉุกเฉิน) 10")])).toEqual({ accountId: "cash" });
    // Once the user picked, it's remembered.
    const remembered = { ...ctx, accounts, accountAliases: [{ alias_normalized: "kbank 8710", account_id: "cash" }] };
    expect(suggestSlipFields(slip({ paymentMethod: "KBank", payerAccount: "8710" }), remembered).accountId).toBe("cash");
  });

  it("uses the slip's memo to pick the category", () => {
    const food = suggestSlipFields(slip({ merchant: "ฟู้ดพาทิโอ", note: "ชาเขียว" }), ctx);
    expect(food.categoryId).toBe(FOOD);
    // A memo that names nothing ("42/40") leaves the category undecided.
    expect(suggestSlipFields(slip({ merchant: "นาย ณภัทร", note: "42/40" }), ctx).categoryId).toBe(OTHER);
  });

  it("the account remembered for this payer wins over everything else", () => {
    const daily = { id: "d1", name: "ใช้จ่ายรายวัน", account_type: "bank" as const, institution: null, is_archived: false };
    const withAlias = {
      ...ctx,
      accounts: [...ctx.accounts, daily],
      accountAliases: [{ alias_normalized: "kbank 8710", account_id: "d1" }],
    };
    expect(suggestSlipFields(slip({ paymentMethod: "K PLUS", payerAccount: "8710" }), withAlias).accountId).toBe("d1");
    // Another KBank account (other digits) isn't this one — falls through to the name match.
    expect(suggestSlipFields(slip({ paymentMethod: "K PLUS", payerAccount: "1234" }), withAlias).accountId).toBe(KBANK);
    // The bank alone remembered: any slip from that bank.
    const bankOnly = { ...withAlias, accountAliases: [{ alias_normalized: "kbank", account_id: "d1" }] };
    expect(suggestSlipFields(slip({ paymentMethod: "Kasikorn", payerAccount: null }), bankOnly).accountId).toBe("d1");
  });

  it("names the payer the same way however the slip prints the bank", () => {
    expect(slipPayer("K PLUS", "8710")).toMatchObject({ bank: "kbank", specific: "kbank 8710", label: "K PLUS 8710" });
    expect(slipPayer("ธ.กสิกรไทย", null)).toMatchObject({ bank: "kbank", specific: null });
    expect(slipPayer(null, null)).toBeNull();
    expect(samePayer(slipPayer("KBank", "8710"), slipPayer("K PLUS", "8710"))).toBe(true);
    expect(samePayer(slipPayer("KBank", "8710"), slipPayer("K PLUS", "1234"))).toBe(false);
    expect(samePayer(slipPayer("KBank", "8710"), slipPayer("K PLUS", null))).toBe(true);
    expect(samePayer(slipPayer("KBank", null), slipPayer("SCB", null))).toBe(false);
  });

  it("reads the memo and only the visible digits of the paying account", () => {
    const x = normalizeReceiptModelOutput(
      JSON.stringify({ amount: 38.5, merchant: "Major", note: "  น้ำเปล่า ", payer_account: "xxx-x-x8710-x", confidence: "high" }),
      TODAY
    );
    expect(x).toMatchObject({ note: "น้ำเปล่า", payerAccount: "8710" });
    expect(payerAccountDigits("xxx-x-xx1x-x")).toBeNull();
    expect(payerAccountDigits("123-4-56789-0")).toBe("7890");
  });

  it("status: not a slip, already recorded, or waiting", () => {
    expect(slipStatusFor(slip({ isPaymentDocument: false }), false)).toBe("not_slip");
    expect(slipStatusFor(slip({ amountCents: null }), false)).toBe("not_slip");
    expect(slipStatusFor(slip({}), true)).toBe("duplicate");
    expect(slipStatusFor(slip({}), false)).toBe("pending");
  });

  it("flags a possible duplicate only for the same amount ±1 day and a matching merchant", () => {
    const tx = (id: string, date: string, merchant: string | null, cents = 24900) => ({ id, amountCents: cents, date, merchant, description: null });
    const s = { amountCents: 24900, date: "2026-10-25", merchant: "KFC" };
    expect(findPossibleDuplicate(s, [tx("a", "2026-10-26", "KFC Central")])).toBe("a");
    expect(findPossibleDuplicate(s, [tx("a", "2026-10-27", "KFC")])).toBeNull();
    expect(findPossibleDuplicate(s, [tx("a", "2026-10-25", "Starbucks")])).toBeNull();
    expect(findPossibleDuplicate(s, [tx("a", "2026-10-25", "KFC", 25000)])).toBeNull();
    expect(findPossibleDuplicate(s, [tx("a", "2026-10-25", null)])).toBe("a");
  });
});

// ---------------------------------------------------------------------------

describe("ingestSlipImage", () => {
  it("reads a slip into a waiting row with account + category — and creates no transaction", async () => {
    const result = await ingestSlipImage(db as never, { userId: USER_A, image: image(1), origin: "upload", today: TODAY });
    expect(result.status).toBe("queued");
    const [row] = db.rows("slip_inbox");
    expect(row).toMatchObject({
      user_id: USER_A,
      status: "pending",
      amount: "249.00",
      slip_date: "2026-10-25",
      merchant: "KFC",
      reference: "REF-0001",
      account_id: KBANK,
      category_id: FOOD,
      confidence: "high",
    });
    expect(db.rows("transactions")).toHaveLength(0);
    expect(db.rows("ai_usage_log")).toEqual([expect.objectContaining({ user_id: USER_A, feature: "capture" })]);
  });

  it("scopes every query to the user (the service-role path depends on it)", async () => {
    await ingestSlipImage(db as never, { userId: USER_A, image: image(1), origin: "shortcut", today: TODAY });
    const reads = db.log.filter((q) => q.op === "select" && q.table !== "categories");
    expect(reads.length).toBeGreaterThan(4);
    for (const q of reads) expect(q.filterColumns).toContain("user_id");
    const categories = db.log.find((q) => q.table === "categories");
    expect(categories?.filterColumns).toContain("is_system|user_id");
  });

  it("skips the same photo sent again before any AI call", async () => {
    await ingestSlipImage(db as never, { userId: USER_A, image: image(1), origin: "shortcut", today: TODAY });
    const again = await ingestSlipImage(db as never, { userId: USER_A, image: image(1), origin: "shortcut", today: TODAY });
    expect(again.status).toBe("already");
    expect(modelCalls).toBe(1);
    expect(db.rows("slip_inbox")).toHaveLength(1);
  });

  it("a different photo of the same slip (same reference) is not queued twice", async () => {
    await ingestSlipImage(db as never, { userId: USER_A, image: image(1), origin: "shortcut", today: TODAY });
    const again = await ingestSlipImage(db as never, { userId: USER_A, image: image(2), origin: "shortcut", today: TODAY });
    expect(again.status).toBe("already");
    expect(db.rows("slip_inbox").filter((r) => r.status === "pending")).toHaveLength(1);
  });

  it("a non-slip photo keeps only its hash, so it's never read again", async () => {
    modelReply = slipJson({ is_payment_document: false, amount: null, merchant: null, reference: null });
    const result = await ingestSlipImage(db as never, { userId: USER_A, image: image(3), origin: "shortcut", today: TODAY });
    expect(result.status).toBe("not_slip");
    const [row] = db.rows("slip_inbox");
    expect(row).toMatchObject({ status: "not_slip", amount: null, merchant: null, reference: null });
    expect(row.image_sha256).toMatch(/^[0-9a-f]{64}$/);
    await ingestSlipImage(db as never, { userId: USER_A, image: image(3), origin: "shortcut", today: TODAY });
    expect(modelCalls).toBe(1);
  });

  it("a slip already recorded (same reference on a transaction) is marked duplicate, not shown", async () => {
    db.rows("transactions").push({ id: "tx-1", user_id: USER_A, reference: "REF-0001", amount: "249.00", transaction_date: "2026-10-25" });
    const result = await ingestSlipImage(db as never, { userId: USER_A, image: image(4), origin: "shortcut", today: TODAY });
    expect(result.status).toBe("duplicate");
    expect(db.rows("slip_inbox")[0].status).toBe("duplicate");
  });

  it("another user's transaction with the same reference doesn't count", async () => {
    db.rows("transactions").push({ id: "tx-b", user_id: USER_B, reference: "REF-0001", amount: "249.00", transaction_date: "2026-10-25" });
    const result = await ingestSlipImage(db as never, { userId: USER_A, image: image(5), origin: "shortcut", today: TODAY });
    expect(result.status).toBe("queued");
  });

  it("flags a same-amount, nearby, same-shop transaction as a possible duplicate", async () => {
    db.rows("transactions").push({ id: "tx-2", user_id: USER_A, reference: null, amount: "249.00", transaction_date: "2026-10-26", merchant: "KFC", description: null });
    await ingestSlipImage(db as never, { userId: USER_A, image: image(6), origin: "shortcut", today: TODAY });
    expect(db.rows("slip_inbox")[0]).toMatchObject({ status: "pending", possible_duplicate_of: "tx-2" });
  });

  it("stops at the monthly capture quota without calling the model", async () => {
    const now = new Date().toISOString();
    for (let i = 0; i < 60; i++) db.rows("ai_usage_log").push({ user_id: USER_A, feature: "capture", created_at: now });
    const result = await ingestSlipImage(db as never, { userId: USER_A, image: image(7), origin: "shortcut", today: TODAY });
    expect(result.status).toBe("quota");
    expect(modelCalls).toBe(0);
  });

  it("is 'unavailable' when no reader is configured", async () => {
    __setProviderForTesting(null);
    const result = await ingestSlipImage(db as never, { userId: USER_A, image: image(8), origin: "upload", today: TODAY });
    expect(result.status).toBe("unavailable");
  });

  it("keeps the memo and the paying account's digits, and uses the account remembered for them", async () => {
    db.rows("accounts").push({ id: "d1", user_id: USER_A, name: "ใช้จ่ายรายวัน", account_type: "bank", institution: null, is_archived: false });
    db.rows("account_aliases").push(
      { user_id: USER_A, alias_normalized: "kbank 8710", account_id: "d1" },
      // Another user's memory never applies.
      { user_id: USER_B, alias_normalized: "kbank 8710", account_id: B_ACCOUNT }
    );
    modelReply = slipJson({ merchant: "ฟู้ดพาทิโอ", note: "ชาเขียว", payer_account: "xxx-x-x8710-x" });
    await ingestSlipImage(db as never, { userId: USER_A, image: image(20), origin: "shortcut", today: TODAY });
    expect(db.rows("slip_inbox")[0]).toMatchObject({
      note: "ชาเขียว",
      payer_account: "8710",
      account_id: "d1",
      category_id: FOOD,
      read_version: 2,
    });
  });

  it("re-reads a waiting slip from the older reader once (to get its memo), in place", async () => {
    db.rows("slip_inbox").push({
      id: "old-1",
      user_id: USER_A,
      status: "pending",
      origin: "shortcut",
      image_sha256: sha256Hex(image(21).bytes),
      reference: "REF-0001",
      merchant: "KFC",
      note: null,
      read_version: 1,
    });
    modelReply = slipJson({ note: "ข้าวมันไก่" });
    const result = await ingestSlipImage(db as never, { userId: USER_A, image: image(21), origin: "shortcut", today: TODAY });
    expect(result).toEqual({ status: "queued", slipId: "old-1" });
    expect(db.rows("slip_inbox")).toHaveLength(1);
    expect(db.rows("slip_inbox")[0]).toMatchObject({ id: "old-1", note: "ข้าวมันไก่", read_version: 2, origin: "shortcut" });

    // Once re-read, never again.
    await ingestSlipImage(db as never, { userId: USER_A, image: image(21), origin: "shortcut", today: TODAY });
    expect(modelCalls).toBe(1);
  });

  it("doesn't re-read an old slip that's no longer waiting", async () => {
    db.rows("slip_inbox").push({ id: "old-2", user_id: USER_A, status: "confirmed", image_sha256: sha256Hex(image(22).bytes), read_version: 1 });
    expect((await ingestSlipImage(db as never, { userId: USER_A, image: image(22), origin: "shortcut", today: TODAY })).status).toBe("already");
    expect(modelCalls).toBe(0);
  });

  it("still works on a database without migration 0047 (deployed before db push)", async () => {
    for (const c of ["note", "payer_account", "read_version"]) db.missingColumns.add(`slip_inbox.${c}`);
    modelReply = slipJson({ note: "ชาเขียว" });
    expect((await ingestSlipImage(db as never, { userId: USER_A, image: image(23), origin: "shortcut", today: TODAY })).status).toBe("queued");
    const [row] = db.rows("slip_inbox");
    expect(row).toMatchObject({ status: "pending", merchant: "KFC" });
    expect(row).not.toHaveProperty("note");
    // And a resend is still skipped without an AI call.
    await ingestSlipImage(db as never, { userId: USER_A, image: image(23), origin: "shortcut", today: TODAY });
    expect(modelCalls).toBe(1);
  });
});

// ---------------------------------------------------------------------------

describe("Shortcut endpoint /api/capture/slips", () => {
  async function makeToken(userId = USER_A) {
    currentUser = { id: userId };
    const res = await createCaptureToken("iPhone");
    if (!("token" in res)) throw new Error(res.error);
    return res.token;
  }
  const post = (token: string | null, body: BodyInit, type = "image/jpeg") =>
    route.POST(
      new Request("https://app.test/api/capture/slips", {
        method: "POST",
        headers: { "content-type": type, ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body,
      })
    );

  it("stores only the key's hash", async () => {
    const token = await makeToken();
    const [row] = db.rows("capture_tokens");
    expect(row.token_hash).toBe(sha256Hex(token));
    expect(JSON.stringify(row)).not.toContain(token);
  });

  it("rejects a request without a valid key", async () => {
    expect((await post(null, new Uint8Array([1, 2]))).status).toBe(401);
    expect((await post(generateCaptureToken(), new Uint8Array([1, 2]))).status).toBe(401);
    expect(db.rows("slip_inbox")).toHaveLength(0);
  });

  it("a valid key queues the slip for ITS owner only — raw body or multipart", async () => {
    const token = await makeToken();
    const res = await post(token, new Uint8Array([0xff, 0xd8, 9]));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ status: "queued" });

    modelReply = slipJson({ reference: "REF-0002" });
    const form = new FormData();
    form.append("image", new File([new Uint8Array([0xff, 0xd8, 10])], "slip.jpg", { type: "image/jpeg" }));
    const res2 = await route.POST(
      new Request("https://app.test/api/capture/slips", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: form })
    );
    expect(res2.status).toBe(201);

    expect(db.rows("slip_inbox").map((r) => r.user_id)).toEqual([USER_A, USER_A]);
    expect(db.rows("transactions")).toHaveLength(0);
    expect(db.rows("capture_tokens")[0].last_used_at).toBeTruthy();
  });

  it("a revoked key stops working", async () => {
    const token = await makeToken();
    await revokeCaptureToken(db.rows("capture_tokens")[0].id as string);
    expect((await post(token, new Uint8Array([0xff, 0xd8, 11]))).status).toBe(401);
  });

  it("another user can't revoke my key", async () => {
    await makeToken(USER_A);
    currentUser = { id: USER_B };
    await revokeCaptureToken(db.rows("capture_tokens")[0].id as string);
    expect(db.rows("capture_tokens")[0].revoked_at ?? null).toBeNull();
  });

  it("refuses unsupported image types and says how to fix it", async () => {
    const token = await makeToken();
    const res = await post(token, new Uint8Array([1, 2, 3]), "image/heic");
    expect(res.status).toBe(415);
    expect((await res.json()).message).toMatch(/JPEG/);
  });

  it("GET checks the key without returning any financial data", async () => {
    const token = await makeToken();
    const res = await route.GET(new Request("https://app.test/api/capture/slips", { headers: { authorization: `Bearer ${token}` } }));
    expect(res.status).toBe(200);
    expect(Object.keys(await res.json()).sort()).toEqual(["message", "status"]);
  });
});

// ---------------------------------------------------------------------------

describe("confirm / dismiss", () => {
  async function queue(byte = 1) {
    await ingestSlipImage(db as never, { userId: USER_A, image: image(byte), origin: "upload", today: TODAY });
    return db.rows("slip_inbox").at(-1) as Row;
  }
  const input = (slip: Row, over: Record<string, unknown> = {}) => ({
    slipId: slip.id as string,
    amountCents: 24900,
    accountId: KBANK,
    categoryId: FOOD,
    merchant: "KFC",
    date: "2026-10-25",
    ...over,
  });

  it("✓ creates exactly one confirmed transaction, even when tapped twice", async () => {
    const slip = await queue();
    expect(await confirmSlip(input(slip))).toEqual({ success: true });
    expect(await confirmSlip(input(slip))).toEqual({ success: true });
    const txs = db.rows("transactions");
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({
      user_id: USER_A,
      type: "expense",
      amount: "249.00",
      account_id: KBANK,
      category_id: FOOD,
      transaction_date: "2026-10-25",
      source: "receipt",
      review_status: "confirmed",
      reference: "REF-0001",
      client_request_id: slip.id,
    });
    expect(slip).toMatchObject({ status: "confirmed", transaction_id: txs[0].id });
  });

  it("saves the user's edits, not the AI's reading", async () => {
    const slip = await queue();
    await confirmSlip(input(slip, { amountCents: 25900, accountId: CASH, date: "2026-10-24", merchant: "KFC Siam" }));
    expect(db.rows("transactions")[0]).toMatchObject({ amount: "259.00", account_id: CASH, transaction_date: "2026-10-24", merchant: "KFC Siam" });
  });

  it("needs a category, and can't confirm someone else's slip", async () => {
    const slip = await queue();
    expect((await confirmSlip(input(slip, { categoryId: null }))).error).toBeTruthy();
    currentUser = { id: USER_B };
    expect((await confirmSlip(input(slip, { accountId: B_ACCOUNT }))).error).toBeTruthy();
    expect(db.rows("transactions")).toHaveLength(0);
    expect(slip.status).toBe("pending");
  });

  it("a dismissed slip stays out and can't be confirmed", async () => {
    const slip = await queue();
    expect(await dismissSlip(slip.id as string)).toEqual({ success: true });
    expect(slip.status).toBe("dismissed");
    expect((await confirmSlip(input(slip))).error).toBeTruthy();
    expect(db.rows("transactions")).toHaveLength(0);
  });

  it("saves the memo as the description", async () => {
    modelReply = slipJson({ note: "น้ำเปล่า" });
    const slip = await queue();
    await confirmSlip(input(slip, { note: "น้ำเปล่า 2 ขวด" }));
    expect(db.rows("transactions")[0]).toMatchObject({ description: "น้ำเปล่า 2 ขวด", merchant: "KFC" });
  });

  it("remembers the paying account and re-points the other waiting slips from it — only the user's own", async () => {
    modelReply = slipJson({ payer_account: "xxx-x-x8710-x", reference: "R1" });
    const first = await queue(31);
    modelReply = slipJson({ payer_account: "xxx-x-x8710-x", reference: "R2" });
    const second = await queue(32);
    modelReply = slipJson({ payer_account: "xxx-x-x1234-x", reference: "R3" });
    const otherCard = await queue(33);
    db.rows("slip_inbox").push({ id: "b-slip", user_id: USER_B, status: "pending", payment_method: "K PLUS", payer_account: "8710", account_id: B_ACCOUNT });
    expect(second.account_id).toBe(KBANK);

    const res = await confirmSlip(input(first, { accountId: CASH }));
    expect(res).toEqual({ success: true, repointed: 1 });
    expect(second.account_id).toBe(CASH);
    expect(otherCard.account_id).toBe(KBANK);
    expect(db.rows("slip_inbox").find((r) => r.id === "b-slip")?.account_id).toBe(B_ACCOUNT);
    expect(db.rows("account_aliases")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ user_id: USER_A, alias_normalized: "kbank 8710", account_id: CASH, source: "learned" }),
        expect.objectContaining({ user_id: USER_A, alias_normalized: "kbank", account_id: CASH, source: "learned" }),
      ])
    );

    // The next slip from that account is pre-filled.
    modelReply = slipJson({ payer_account: "xxx-x-x8710-x", reference: "R4" });
    expect((await queue(34)).account_id).toBe(CASH);
  });

  it("✓ on the pre-filled account teaches nothing — only a real pick is remembered", async () => {
    modelReply = slipJson({ payer_account: "xxx-x-x8710-x", reference: "R1" });
    const first = await queue(41);
    modelReply = slipJson({ payer_account: "xxx-x-x8710-x", reference: "R2" });
    const second = await queue(42);
    expect(first.account_id).toBe(KBANK);
    expect(await confirmSlip(input(first, { accountId: KBANK }))).toEqual({ success: true });
    expect(db.rows("account_aliases")).toHaveLength(0);
    expect(second.account_id).toBe(KBANK);
  });

  it("bulk upload goes through the same pipeline for the signed-in user", async () => {
    const fd = new FormData();
    fd.append("image", new File([new Uint8Array([0xff, 0xd8, 42])], "a.jpg", { type: "image/jpeg" }));
    expect(await uploadSlipImage(fd)).toEqual({ status: "queued" });
    expect(db.rows("slip_inbox")[0]).toMatchObject({ user_id: USER_A, origin: "upload" });
    currentUser = null;
    expect(await uploadSlipImage(fd)).toEqual({ status: "invalid" });
  });
});
