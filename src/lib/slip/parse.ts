import { parseMoneyToCents } from "@/lib/financial/money";
import { parseLeadingDate, thaiDigitsToArabic } from "@/lib/import/pdf/dates";
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
function amountIn(lines: string[], fee: boolean): number | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isFee = /ค่าธรรมเนียม|\bfee\b/i.test(line);
    if (fee !== isFee) continue;
    if (!fee && i > 0 && /^(?:ค่าธรรมเนียม|fee)\s*[:：]?\s*$/i.test(lines[i - 1])) continue;
    const label = /จำนวนเงิน|ยอดโอน|ยอดเงิน|\bamount\b/i;
    if (!fee && !label.test(line) && !/฿|บาท|\bTHB\b/i.test(line)) continue;
    const payload = line.replace(/.*?(?:ค่าธรรมเนียม|\bfee\b|จำนวนเงิน|ยอดโอน|ยอดเงิน|\bamount\b)\s*[:：]?/i, "");
    const candidate = payload.trim() || lines[i + 1] || "";
    const found = new RegExp(`^(?:฿|THB)?\\s*(${moneyToken})(?:\\s*(?:บาท|THB|฿))?\\s*$`, "i").exec(candidate);
    if (found) return money(found[1]);
  }
  return null;
}
const senderLabel = /^(?:จาก|ผู้โอน(?:เงิน)?|ผู้ส่ง|sender\b(?:\s+name\b)?|from\b)\s*[:：]?\s*/i;
const receiverLabel = /^(?:ไปยัง|ถึง|ผู้รับ(?:เงิน)?|receiver\b(?:\s+name\b)?|recipient\b|to\b)\s*[:：]?\s*/i;
const metadata = /จำนวนเงิน|ยอดโอน|ค่าธรรมเนียม|เลขที่รายการ|รหัสอ้างอิง|วันที่|เวลา|\b(?:amount|fee|ref|transaction|date|time)\b/i;
function party(lines: string[], side: "sender" | "receiver"): SlipParty {
  const label = side === "sender" ? senderLabel : receiverLabel;
  const start = lines.findIndex((line) => label.test(line));
  if (start < 0) return { name: null, account: null, bank: null };
  const block: string[] = [lines[start].replace(label, "")];
  for (const line of lines.slice(start + 1)) {
    if (senderLabel.test(line) || receiverLabel.test(line) || metadata.test(line)) break;
    block.push(line);
  }
  let name: string | null = null;
  let account: string | null = null;
  for (const line of block) {
    const match = /(?:[xX*•\dOoIl|][\dxX*•OoIl|\s-]{4,}[xX*•\dOoIl|])/.exec(line);
    if (match && /\d/.test(digits(match[0]))) account ??= digits(match[0]).trim();
    const cleaned = line.replace(match?.[0] ?? /$^/, "").replace(/(?:เลขที่บัญชี|บัญชี|พร้อมเพย์|เบอร์โทร|เลขบัตรประชาชน|e-wallet|promptpay|account|phone|national id)\s*[:：]?/gi, "").trim();
    if (cleaned && !detectBank(cleaned) && !/^[-:：]+$/.test(cleaned)) name ??= cleaned;
  }
  return { name, account, bank: detectBank(block.join("\n")) };
}

/** Heuristic text extraction; confidence is evidence strength, not a calibrated probability. */
export function parseSlipText(text: string, options: ParseSlipOptions = {}): ParsedSlip {
  // Bound work for accidental non-slip input; never retain the OCR source.
  const normalized = thaiDigitsToArabic(text.slice(0, 100_000)).replace(/\r/g, "\n").replace(/[\t\u00a0]/g, " ");
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
      : parseLeadingDate(tail, options.referenceYear ?? 2026);
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
  const sender = party(lines, "sender");
  const receiver = party(lines, "receiver");
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
