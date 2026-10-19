import { KNOWN_SUBSCRIPTION_SERVICES } from "./keywords";

/** Deterministic subscription commands. No database or model calls. */
export interface SubscriptionIntent {
  serviceName: string | null;
  frequency: "monthly" | "yearly";
}

const CADENCE = /รายเดือน|รายปี|(?:จ่าย)?เดือนละ|ปีละ|ต่อเดือน|ต่อปี|\b(?:monthly|yearly|annual|annually)\b/i;
const SIGNUP = /สมัครสมาชิก|ต่อสมาชิก|ต่ออายุ|สมัคร(?!\s*(?:เรียน|งาน|สอบ|แข่งขัน))|ซับ|\b(?:sub|subscribe|subscription)\b/i;
const KNOWN_SERVICE = new RegExp(`(?<![a-z0-9])(?:${KNOWN_SUBSCRIPTION_SERVICES.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![a-z0-9])`, "i");
const MARKERS = /สมัครสมาชิก|ต่อสมาชิก|ต่ออายุ|สมัคร|ซับ|รายเดือน|รายปี|(?:จ่าย)?เดือนละ|ปีละ|ต่อเดือน|ต่อปี|\b(?:sub|subscribe|subscription|monthly|yearly|annual|annually)\b/gi;

/** Cadence alone can describe an ordinary bill and does not force subscription defaults. */
export function hasExplicitSubscriptionIntent(text: string): boolean {
  return SIGNUP.test(text) || KNOWN_SERVICE.test(text);
}

function cleanService(text: string): string | null {
  const service = text.replace(MARKERS, " ")
    .replace(/(?:฿\s*)?\d[\d,]*(?:\.\d{1,2})?\s*(?:บาท|baht|thb|฿)?/gi, " ")
    .replace(/^(?:(?:ฉัน|ผม|เรา|เพิ่ง|ได้|ไป|จ่าย|กรอก|ค่า|ใช้|บริการ)\s*)+/u, "")
    .replace(/(?:\s*(?:ไป|จ่าย(?:เงิน)?(?:จาก|ด้วย|ผ่าน)?|ด้วย|จาก|ผ่าน|แล้ว|ครับ|ค่ะ|วันนี้|นะ))+(?=\s*$)/u, "")
    .replace(/\b(?:i|just|paid|pay|for)\b/gi, " ")
    .replace(/[฿,:;!?()]/g, " ").replace(/\s+/g, " ").trim();
  return service ? service.slice(0, 120) : null;
}

export function parseSubscriptionIntent(text: string): SubscriptionIntent | null {
  if (parseCancelIntent(text)) return null;
  // Tuition / job applications are one-off payments unless cadence or a known service is explicit.
  if (!CADENCE.test(text) && !KNOWN_SERVICE.test(text) && /สมัคร\s*(?:เรียน|งาน|สอบ|แข่งขัน)/.test(text)) return null;
  if (!CADENCE.test(text) && !hasExplicitSubscriptionIntent(text)) return null;
  return {
    serviceName: cleanService(text),
    frequency: /ปีละ|รายปี|ต่อปี|\b(?:yearly|annual|annually)\b/i.test(text) ? "yearly" : "monthly",
  };
}

export function parseCancelIntent(text: string): { serviceQuery: string } | null {
  // Anchor the command: a cancellation FEE (ค่ายกเลิกตั๋ว) remains an expense.
  const command = /^(?:(?:ฉัน|ผม|เรา|เพิ่ง|ได้)\s*)*(ยกเลิก|เลิกสมัคร|unsubscribe\b|cancel\s+(?:subscription\b|sub\b))\s*(.*)$/i.exec(text.trim());
  if (!command) return null;
  // Cancellations with money can be ticket/hotel refunds. Require subscription
  // context in that case; เลิกสมัคร always explicitly cancels a signup.
  if (command[1] !== "เลิกสมัคร" && /\p{N}/u.test(text)
    && !/\b(?:sub|subscription)\b|สมาชิก|ซับ|สมัคร|รายเดือน|รายปี/i.test(command[0])
    && !KNOWN_SERVICE.test(command[2])) return null;
  // Empty query still represents cancellation, never a payment.
  return { serviceQuery: cleanService(command[2]) ?? "" };
}

export interface CancelItem {
  id: string;
  merchant: string | null;
  description: string | null;
  is_active: boolean;
}
export type CancelMatch<T> = { status: "single"; item: T } | { status: "multiple"; candidates: T[] } | { status: "none" };

function compact(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, "");
}
function similarity(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return 1 - row[b.length] / Math.max(a.length, b.length);
}
export function matchRecurringForCancel<T extends CancelItem>(query: string, items: T[]): CancelMatch<T> {
  const q = compact(query);
  if (!q) return { status: "none" };
  const candidates = items.filter((item) => item.is_active && [item.merchant, item.description].some((label) => {
    const name = compact(label ?? "");
    return name && (name === q || (q.length >= 3 && name.includes(q)) || (Math.min(q.length, name.length) >= 4 && similarity(q, name) >= 0.8));
  }));
  return candidates.length === 1 ? { status: "single", item: candidates[0] }
    : candidates.length > 1 ? { status: "multiple", candidates } : { status: "none" };
}
