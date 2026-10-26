import { parseMoneyToCents } from "@/lib/financial/money";
import { monthFromName, parseLeadingDate, thaiDigitsToArabic } from "@/lib/import/pdf/dates";
import { detectBank } from "./banks";
import type { ParsedSlip, ParseSlipOptions, SlipParty } from "./types";

function digits(value: string): string {
  return thaiDigitsToArabic(value).replace(/[Oo]/g, "0").replace(/[lI|]/g, "1");
}
const numeric = "[0-9OoIl|]";
const moneyToken = `${numeric}+(?:[, ]+${numeric}{3})*(?:\\.${numeric}{1,2})?`;
function money(value: string): number | null {
  const normalized = digits(value).replace(/[,\s]/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const cents = parseMoneyToCents(normalized);
  return Number.isSafeInteger(cents) ? cents : null;
}
const amountLabel = /จำนวน(?:\s*เงิน)?|ยอดโอน|ยอดเงิน|\bamount\b/i;
const feeLabel = /ค่าธรรมเนียม|\bfee\b/i;
/** A currency marker ties the number to a payment. Leading OCR debris ("2. 70.00 บาท") must not win. */
function lineAmount(line: string): number | null {
  const trimmed = line.trim();
  const whole = new RegExp(`^(?:฿|THB)?\\s*(${moneyToken})(?:\\s*(?:บาท|THB|฿))?\\s*$`, "i").exec(trimmed);
  if (whole) return money(whole[1]);
  const marked = new RegExp(`(?:฿\\s*|THB\\s+)?(${moneyToken})\\s*(?:บาท|THB|฿)`, "gi");
  let zero: number | null = null;
  for (const match of trimmed.matchAll(marked)) {
    const value = money(match[1]);
    if (value === null) continue;
    if (value > 0) return value;
    zero ??= value;
  }
  return zero;
}
function amountIn(lines: string[], fee: boolean): number | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const feeHeaderAbove = i > 0 && /^(?:ค่าธรรมเนียม|fee)\s*[:：]?\s*$/i.test(lines[i - 1]);
    const isFee = feeLabel.test(line) || feeHeaderAbove;
    if (fee !== isFee) continue;
    const labeled = fee ? feeLabel.test(line) : amountLabel.test(line);
    const stripped = labeled
      ? line.replace(/.*?(?:ค่าธรรมเนียม|\bfee\b|จำนวน(?:\s*เงิน)?|ยอดโอน|ยอดเงิน|\bamount\b)\s*[:：]?/i, "").trim()
      : line.trim();
    const own = stripped ? lineAmount(stripped) : null;
    if ((labeled || /฿|บาท|\bTHB\b/i.test(line)) && own !== null) return own;
    if (labeled) {
      const next = lines[i + 1];
      if (next && !feeLabel.test(next)) {
        const value = lineAmount(next);
        if (value !== null) return value;
      }
    }
  }
  return null;
}
const senderLabel = /^(?:จาก|ผู้โอน(?:เงิน)?|ผู้ส่ง|sender\b(?:\s+name\b)?|from\b)\s*[:：]?\s*/i;
const receiverLabel = /^(?:ไปยัง|ถึง|ผู้รับ(?:เงิน)?|receiver\b(?:\s+name\b)?|recipient\b|to\b)\s*[:：]?\s*/i;
const metadata = /จำนวน|ยอดโอน|ค่าธรรมเนียม|เลขที่รายการ|รหัสอ้างอิง|วันที่|เวลา|\b(?:amount|fee|ref|transaction|date|time)\b/i;
const accountPattern = /(?:[xX*•\dOoIl|][\dxX*•OoIl|\s-]{4,}[xX*•\dOoIl|])/;
function readParty(block: string[]): SlipParty {
  let name: string | null = null;
  let nameThai = -1;
  let account: string | null = null;
  for (const line of block) {
    const match = accountPattern.exec(line);
    if (match && /\d/.test(digits(match[0]))) account ??= digits(match[0]).trim();
    const cleaned = line.replace(match?.[0] ?? /$^/, "").replace(/(?:เลขที่บัญชี|บัญชี|รหัสพร้อมเพย์|พร้อมเพย์|เบอร์โทร|เลขบัตรประชาชน|e-wallet|promptpay|account|phone|national id)\s*[:：]?/gi, "").trim();
    if (!cleaned || detectBank(cleaned) || /^[-:：]+$/.test(cleaned) || /^(?:prompt|pay|รหัส)$/i.test(cleaned) || cleaned.length < 2) continue;
    // The arrow between K PLUS parties OCRs as a 1–2 character line. Prefer the line that is actually a name.
    const thai = cleaned.match(/[฀-๿]/g)?.length ?? 0;
    if (thai > nameThai) { name = cleaned; nameThai = thai; }
  }
  return { name, account, bank: detectBank(block.join("\n")) };
}
function party(lines: string[], side: "sender" | "receiver"): SlipParty {
  const label = side === "sender" ? senderLabel : receiverLabel;
  const start = lines.findIndex((line) => label.test(line));
  if (start < 0) return { name: null, account: null, bank: null };
  const block: string[] = [lines[start].replace(label, "")];
  for (const line of lines.slice(start + 1)) {
    if (senderLabel.test(line) || receiverLabel.test(line) || metadata.test(line)) break;
    block.push(line);
  }
  return readParty(block);
}
/**
 * K PLUS prints two stacked parties and no จาก/ไปยัง labels.
 * The first account block is the sender; the next is the receiver or biller.
 */
function unlabeledParties(lines: string[], referenceYear: number): { sender: SlipParty; receiver: SlipParty } | null {
  const end = lines.findIndex((line) => metadata.test(line));
  if (end < 0) return null;
  const head = lines.slice(0, end).filter((line) => !/^(?:โอน|จ่าย)\S*สำเร็จ|สแกนตรวจสอบ|^\s*k\+\s*$/i.test(line) && !/^[\s|↓↑Vv\\/<>.\-—–*=]+$/.test(line) && !parseLeadingDate(repairOcrDateTail(line), referenceYear));
  const groups: string[][] = [];
  let current: string[] = [];
  for (const line of head) {
    current.push(line);
    if (accountPattern.test(line) && /\d/.test(digits(line))) {
      groups.push(current);
      current = [];
    }
  }
  // The second mask is often smashed ("200<-%-%0762-%") and must not drop the name above it.
  if (current.length) groups.push(current);
  if (groups.length < 2) return null;
  const sender = readParty(groups[0]);
  const receiver = readParty(groups[1]);
  return sender.name && receiver.name ? { sender, receiver } : null;
}
/**
 * Tesseract reads the dot in พ.ย. as sara u ("พ.ุย.", "พุย.") and sometimes inserts ผ.
 * Only the month token of a leading date is rewritten, and only when it is not already a month.
 */
function repairOcrDateTail(tail: string): string {
  return tail.replace(/^(\d{1,2})([\s.-]+)([^\d\s/]{1,24})/, (full, day: string, gap: string, month: string) => {
    if (monthFromName(month)) return full;
    const compact = month.replace(/[.\u0e38\u0e39]/g, "");
    if (monthFromName(compact)) return `${day}${gap}${compact}`;
    if (compact.length <= 4) {
      const withoutExtra = compact.replace(/ผ/g, "");
      if (withoutExtra !== compact && monthFromName(withoutExtra)) return `${day}${gap}${withoutExtra}`;
      const korForKhor = compact.replace(/ด/g, "ค");
      if (korForKhor !== compact && monthFromName(korForKhor)) return `${day}${gap}${korForKhor}`;
    }
    return full;
  });
}

/** Heuristic text extraction; confidence is evidence strength, not a calibrated probability. */
export function parseSlipText(text: string, options: ParseSlipOptions = {}): ParsedSlip {
  // Bound work for accidental non-slip input; never retain the OCR source.
  const normalized = thaiDigitsToArabic(text.slice(0, 100_000).normalize("NFC").replace(/\u0e4d\u0e32/g, "\u0e33")).replace(/\r/g, "\n").replace(/[\t\u00a0]/g, " ");
  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  let date: string | null = null;
  // Search date-like starts rather than coercing letters in names or references.
  const dateText = normalized
    .replace(/[0-9OoIl|]+(?:[/.:\-][0-9OoIl|]+)+/g, digits)
    .replace(/(?<![\p{L}\d])[0-9OoIl|]*[0-9][0-9OoIl|]*(?![\p{L}\d])/gu, digits);
  for (const match of dateText.matchAll(/(?<![\w\d])[0-9]{1,4}(?=[\s/.-])/g)) {
    const tail = dateText.slice(match.index);
    const iso = /^(\d{4})-(\d{2})-(\d{2})(?!\d)/.exec(tail);
    const parsed = iso
      ? parseLeadingDate(`${iso[3]}/${iso[2]}/${iso[1]}`, options.referenceYear ?? 2026)
      : parseLeadingDate(repairOcrDateTail(tail), options.referenceYear ?? 2026);
    if (parsed) { date = parsed.iso; break; }
  }
  const timeText = date ? dateText : "";
  const time = /(?<![\d.:])(\d{1,2})(?::(\d{2})(?::(\d{2}))?|\.(\d{2})\s*น\.?)(?![\d:])/.exec(timeText);
  let dateTime: string | null = null;
  if (date && time) {
    const [, hours, minutes, seconds, dotMinutes] = time;
    if (+hours < 24 && +(minutes ?? dotMinutes) < 60 && +(seconds ?? 0) < 60) {
      dateTime = `${date}T${hours.padStart(2, "0")}:${minutes ?? dotMinutes}:${seconds ?? "00"}+07:00`;
    }
  }
  const reference = /(?:เลขที่รายการ|รหัสอ้างอิง|เลขอ้างอิง|\btransaction\s*(?:id|no\.?)\b|\bref(?:erence)?(?:\s*(?:id|no\.?))?\b)\s*[:：#]?\s*([A-Za-z0-9][A-Za-z0-9_-]*)/i.exec(normalized)?.[1] ?? null;
  const referenceYear = options.referenceYear ?? 2026;
  let sender = party(lines, "sender");
  let receiver = party(lines, "receiver");
  if (!sender.name && !receiver.name) {
    const stacked = unlabeledParties(lines, referenceYear);
    if (stacked) ({ sender, receiver } = stacked);
  }
  const amount = amountIn(lines, false);
  const fee = amountIn(lines, true);
  const confidence: ParsedSlip["confidence"] = {
    amount: amount === null ? 0 : 0.95, fee: fee === null ? 0 : 0.95,
    date: date ? 0.9 : 0, dateTime: dateTime ? 0.9 : 0,
    senderName: sender.name ? 0.75 : 0, senderAccount: sender.account ? 0.85 : 0, senderBank: sender.bank ? 0.9 : 0,
    receiverName: receiver.name ? 0.75 : 0, receiverAccount: receiver.account ? 0.85 : 0, receiverBank: receiver.bank ? 0.9 : 0,
    reference: reference ? 0.9 : 0,
  };
  return { amount, fee, date, dateTime, sender, receiver, reference, confidence,
    overallConfidence: Object.values(confidence).reduce((sum, value) => sum + value, 0) / Object.keys(confidence).length };
}
