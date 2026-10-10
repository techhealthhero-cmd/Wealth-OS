/**
 * Spoken transfers between the user's OWN accounts —
 * "โอนเงินจากบัญชี Cash ไปบัญชี Dime 3000" → Cash → Dime ฿3,000.
 *
 * Pure and deterministic. Each side of a transfer resolves to one of:
 *  - matched   — a real account, by its exact name / bank hint, or by a
 *                close-sounding word ("ไดม์" → Dime; `heard` says which word)
 *  - ambiguous — several accounts fit ("บัญชีออม" → ออมทรัพย์ / ออมเงินเที่ยว)
 *  - unknown   — clearly an account, but none fits ("เข้าบัญชีกระปุกหมู")
 * The UI asks the user for the last two; it never guesses. "โอนเงินให้แม่
 * 500" (a person, not an account) stays an ordinary expense.
 */
import { ACCOUNT_HINTS } from "./keywords";
import { findKeyword, normalizeText, type CaptureAccount } from "./transaction-parser";

export interface TransferAccounts {
  fromAccountId: string;
  toAccountId: string;
}

export type AccountSlot =
  | { status: "matched"; accountId: string; heard: string | null }
  | { status: "ambiguous"; candidates: string[]; heard: string }
  | { status: "unknown"; heard: string | null };

export interface TransferIntent {
  from: AccountSlot;
  to: AccountSlot;
}

interface Mention {
  accountId: string;
  start: number;
  end: number;
}

const TRANSFER_VERBS = /โอน|ย้ายเงิน|ย้าย|ถอน|(?<![a-z])(?:transfer|move|withdraw)/;
const WITHDRAW = /ถอน|(?<![a-z])withdraw/;
const FROM_WORDS = ["ออกจาก", "จาก", "from", "out of"];
const TO_WORDS = ["ไปที่", "ไปยัง", "ไป", "เข้า", "ใส่", "ให้", "into", "to"];
/** Words between the direction word and the account ("จากบัญชี Cash", "into my KBank"). */
const ACCOUNT_NOUN_RE = /^(?:บัญชี|กระเป๋า|account|wallet|my|the)\s*/;
const ACCOUNT_NOUNS = /\s*(?:บัญชี|กระเป๋า|account|wallet|my|the)\s*$/;
/** A person right after the direction word: "ให้แม่", "ไปให้พี่" — money to someone, not an account. */
const PERSON_WORDS = [
  "ให้", "แม่", "พ่อ", "พี่", "น้อง", "แฟน", "เพื่อน", "ลูก", "ยาย", "ปู่", "ย่า", "ป้า", "ลุง", "น้า", "เขา", "คน", "ร้าน",
  "ลูกค้า", "เจ้าของ",
];
const TRAILING_FILLERS = /(?:\s*(?:หน่อย|ด้วย|นะ|ครับ|คับ|ค่ะ|คะ|จ้า|บาท|baht))+$/;

const DIRECTION_RE = new RegExp(
  [...FROM_WORDS.map((w) => ({ w, dir: "from" })), ...TO_WORDS.map((w) => ({ w, dir: "to" }))]
    .sort((a, b) => b.w.length - a.w.length)
    .map(({ w }) => (/^[a-z]/.test(w) ? `(?<![a-z])${w}(?![a-z])` : w))
    .join("|"),
  "g"
);

// ---------------------------------------------------------------------------
// sound keys — "ไดม์" and "Dime" both become "dm"
// ---------------------------------------------------------------------------

const THAI_SOUND: Record<string, string> = {};
for (const [chars, key] of [
  ["กขฃคฅฆ", "k"], ["ง", "n"], ["จฉชฌ", "c"], ["ซศษส", "s"], ["ดฎ", "d"], ["ตฏ", "t"], ["ถฐทธฑฒ", "t"],
  ["นณ", "n"], ["บ", "b"], ["ป", "p"], ["ผพภ", "p"], ["ฝฟ", "f"], ["ม", "m"], ["รลฬ", "l"],
] as const) {
  for (const ch of chars) THAI_SOUND[ch] = key;
}
const LATIN_SOUND: Record<string, string> = {
  b: "b", c: "k", d: "d", f: "f", g: "k", j: "c", k: "k", l: "l", m: "m", n: "n", p: "p", q: "k", r: "l", s: "s",
  t: "t", x: "ks", z: "s",
};
/** How Thai speakers say a capital letter ("SCB" → "เอสซีบี", "K" in KBank → "เค"). */
const LETTER_NAMES: Record<string, string> = {
  a: "เอ", b: "บี", c: "ซี", d: "ดี", e: "อี", f: "เอฟ", g: "จี", h: "เอช", i: "ไอ", j: "เจ", k: "เค", l: "แอล", m: "เอ็ม",
  n: "เอ็น", o: "โอ", p: "พี", q: "คิว", r: "อาร์", s: "เอส", t: "ที", u: "ยู", v: "วี", w: "ดับเบิลยู", x: "เอ็กซ์", y: "วาย",
  z: "แซด",
};

/** Consonant skeleton, the same for Thai and English spellings of a name. Vowels, tones and silent marks drop out. */
export function soundKey(text: string): string {
  const latin = text
    .toLowerCase()
    .replace(/ph/g, "f")
    .replace(/th/g, "t")
    // "sh"/"ch" sound like ช — use the Thai letter so the c→k rule below skips it.
    .replace(/sh|ch/g, "ช")
    .replace(/ck/g, "k")
    .replace(/ng/g, "n")
    .replace(/qu/g, "kw");
  let out = "";
  for (const ch of latin) {
    const key = THAI_SOUND[ch] ?? LATIN_SOUND[ch] ?? (/\d/.test(ch) ? ch : "");
    if (key && !out.endsWith(key)) out += key;
  }
  return out;
}

/**
 * Ways a name may be said: as written, each of its words ("กสิกร ออมทรัพย์"
 * → "กสิกร"), a short all-caps word spelled out ("SCB" → "เอสซีบี"), or a
 * leading letter ("KBank" → "เคBank").
 */
function spokenForms(name: string): string[] {
  const words = name.split(/[\s()]+/).filter((w) => w.length >= 2);
  const forms = [name, ...(words.length > 1 ? words : [])];
  for (const word of words) {
    if (/^[A-Z]{2,5}$/.test(word)) forms.push([...word.toLowerCase()].map((c) => LETTER_NAMES[c]).join(""));
    const lead = /^([A-Z])([A-Z][a-z]+.*)$/.exec(word);
    if (lead) forms.push(LETTER_NAMES[lead[1].toLowerCase()] + lead[2]);
  }
  return forms;
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** The accounts a heard word could mean: sound-alike first ("ไดม์" → Dime), then names containing the word ("ออม"). */
function closeAccounts(heard: string, accounts: CaptureAccount[]): string[] {
  const heardKey = soundKey(heard);
  const heardLower = heard.toLowerCase();
  const strong: string[] = [];
  const weak: string[] = [];
  for (const account of accounts) {
    const forms = spokenForms(account.name.trim());
    const soundsAlike = forms.some((form) => {
      const key = soundKey(form);
      if (key.length < 2 || heardKey.length < 2) return false;
      return key === heardKey || (Math.min(key.length, heardKey.length) >= 3 && editDistance(key, heardKey) <= 1);
    });
    if (soundsAlike) strong.push(account.id);
    else if ([...heardLower].length >= 2 && account.name.toLowerCase().includes(heardLower)) weak.push(account.id);
  }
  return strong.length > 0 ? strong : weak;
}

// ---------------------------------------------------------------------------
// exact mentions
// ---------------------------------------------------------------------------

/** Every one of the user's accounts the words mention exactly, in reading order (names first, then bank/payment hints). */
export function findAccountMentions(lower: string, accounts: CaptureAccount[]): Mention[] {
  const active = accounts.filter((a) => !a.is_archived);
  const mentions: Mention[] = [];
  const overlaps = (s: number, e: number) => mentions.some((m) => s < m.end && e > m.start);

  for (const account of [...active].sort((a, b) => b.name.length - a.name.length)) {
    const name = account.name.trim().toLowerCase();
    if (name.length < 2) continue;
    const span = findKeyword(lower, name);
    if (span && !overlaps(span.start, span.end)) mentions.push({ accountId: account.id, ...span });
  }
  for (const hint of ACCOUNT_HINTS) {
    for (const phrase of [...hint.phrases].sort((a, b) => b.length - a.length)) {
      const span = findKeyword(lower, phrase);
      if (!span || overlaps(span.start, span.end)) continue;
      const account = active.find((a) => {
        if (hint.type && a.account_type === hint.type) return true;
        if (!hint.aliases) return false;
        const haystack = `${a.name} ${a.institution ?? ""}`.toLowerCase();
        return hint.aliases.some((alias) => haystack.includes(alias.toLowerCase()));
      });
      if (account && !mentions.some((m) => m.accountId === account.id)) mentions.push({ accountId: account.id, ...span });
    }
  }
  return mentions.sort((a, b) => a.start - b.start);
}

function directionBefore(lower: string, start: number): "from" | "to" | null {
  const before = lower.slice(0, start).replace(ACCOUNT_NOUNS, "").trimEnd();
  if (FROM_WORDS.some((w) => before.endsWith(w))) return "from";
  if (TO_WORDS.some((w) => before.endsWith(w))) return "to";
  return null;
}

// ---------------------------------------------------------------------------
// slots — the words after "จาก" / "ไป"
// ---------------------------------------------------------------------------

interface Slot {
  /** The direction word that opened it ("เข้า", "ไป", "จาก"…). */
  word: string;
  start: number;
  end: number;
  heard: string;
  /** "บัญชี…"/"กระเป๋า…" was said — the words name an account for sure. */
  saidAccount: boolean;
}

function findSlots(lower: string): { from: Slot | null; to: Slot | null } {
  const hits = [...lower.matchAll(DIRECTION_RE)].map((m) => ({ word: m[0], index: m.index! }));
  const slots: { from: Slot | null; to: Slot | null } = { from: null, to: null };
  hits.forEach((hit, i) => {
    const dir = FROM_WORDS.includes(hit.word) ? "from" : "to";
    if (slots[dir]) return;
    const start = hit.index + hit.word.length;
    let end = i + 1 < hits.length ? hits[i + 1].index : lower.length;
    const digit = lower.slice(start, end).search(/[\d฿]/);
    if (digit >= 0) end = start + digit;
    let text = lower.slice(start, end).trim();
    const saidAccount = ACCOUNT_NOUN_RE.test(text);
    text = text.replace(ACCOUNT_NOUN_RE, "").replace(TRAILING_FILLERS, "").trim();
    // "จากบัญชี" with nothing after it is not a slot; a person is never an account.
    if (!text && !saidAccount) return;
    slots[dir] = { word: hit.word, start, end, heard: text, saidAccount };
  });
  return slots;
}

function isPerson(slot: Slot): boolean {
  return slot.word === "ให้" || PERSON_WORDS.some((p) => slot.heard.startsWith(p));
}

function resolveSlot(slot: Slot, mentions: Mention[], active: CaptureAccount[], otherSide: string | null = null): AccountSlot {
  const exact = mentions.find((m) => m.start >= slot.start && m.start < Math.max(slot.end, slot.start + 1));
  if (exact) return { status: "matched", accountId: exact.accountId, heard: null };
  if (!slot.heard) return { status: "unknown", heard: null };
  // Money never moves into the account it came from: that one is no candidate.
  const close = closeAccounts(slot.heard, active).filter((id) => id !== otherSide);
  if (close.length === 1) return { status: "matched", accountId: close[0], heard: slot.heard };
  if (close.length > 1) return { status: "ambiguous", candidates: close, heard: slot.heard };
  return { status: "unknown", heard: slot.heard };
}

const isAccountish = (s: AccountSlot, slot: Slot) => s.status !== "unknown" || slot.saidAccount;

/**
 * What a spoken transfer says about its two accounts, or null when the words
 * aren't a transfer between the user's own accounts.
 */
export function detectTransferIntent(input: string, accounts: CaptureAccount[]): TransferIntent | null {
  const lower = normalizeText(input).toLowerCase();
  const active = accounts.filter((a) => !a.is_archived);
  const mentions = findAccountMentions(lower, active);
  const distinct = mentions.filter((m, i) => mentions.findIndex((x) => x.accountId === m.accountId) === i);
  const matched = (accountId: string): AccountSlot => ({ status: "matched", accountId, heard: null });
  const hasVerb = TRANSFER_VERBS.test(lower);

  if (distinct.length >= 2) {
    const [a, b] = distinct;
    const dirA = directionBefore(lower, a.start);
    const dirB = directionBefore(lower, b.start);
    // Without a transfer word, only "จาก X ไป Y" (both directions said) counts —
    // "กาแฟ 80 บัตร KBank" names two accounts but moves nothing between them.
    if (hasVerb || (dirA && dirB && dirA !== dirB)) {
      const bFirst = dirA === "to" || dirB === "from";
      return bFirst ? { from: matched(b.accountId), to: matched(a.accountId) } : { from: matched(a.accountId), to: matched(b.accountId) };
    }
  }
  if (distinct.length === 1 && WITHDRAW.test(lower)) {
    // "ถอนเงิน KBank 1000": cash comes out of the bank into the wallet.
    const cash = active.find((a) => a.account_type === "cash");
    return cash && cash.id !== distinct[0].accountId ? { from: matched(distinct[0].accountId), to: matched(cash.id) } : null;
  }
  if (!hasVerb) return null;

  // Not every account was named exactly: read the words after จาก / ไป.
  const slots = findSlots(lower);
  if (!slots.to || isPerson(slots.to) || (slots.from && isPerson(slots.from))) return null;
  const from = slots.from ? resolveSlot(slots.from, mentions, active) : null;
  const to = resolveSlot(slots.to, mentions, active, from?.status === "matched" ? from.accountId : null);

  const toOk = isAccountish(to, slots.to);
  const fromOk = from !== null && isAccountish(from, slots.from!);
  // "โอนจาก Cash เข้ากระปุกหมู" — an unknown destination still counts when the
  // source is a real account and the word is เข้า/into (money goes INTO something).
  const toInto = to.status === "unknown" && fromOk && ["เข้า", "ใส่", "into"].includes(slots.to.word);
  if (!toOk && !toInto) return null;
  if (from && !fromOk) return null;

  // No source said ("โอนเข้าบัญชีออม 5000"): the default account, like an expense.
  const fromSlot: AccountSlot =
    from ?? (active[0] && !(to.status === "matched" && to.accountId === active[0].id) ? matched(active[0].id) : { status: "unknown", heard: null });
  if (fromSlot.status === "matched" && to.status === "matched" && fromSlot.accountId === to.accountId) return null;
  return { from: fromSlot, to };
}

/** The two accounts of a spoken transfer when both are certain, or null. */
export function detectTransfer(input: string, accounts: CaptureAccount[]): TransferAccounts | null {
  const intent = detectTransferIntent(input, accounts);
  return intent?.from.status === "matched" && intent.to.status === "matched"
    ? { fromAccountId: intent.from.accountId, toAccountId: intent.to.accountId }
    : null;
}
