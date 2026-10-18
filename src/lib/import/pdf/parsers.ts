import { COMMON_CREDIT_HINTS, COMMON_DEBIT_HINTS, COMMON_OPENING_PATTERNS, COMMON_SKIP_PATTERNS, runStatementEngine, type StatementProfile } from "./engine";
import { PdfImportError, type PdfTextLine, type StatementBankId, type StatementParseResult } from "./types";

const HEADERS: Record<StatementBankId, RegExp> = {
  kbank: /kasikorn|\bk\s*bank\b|\bk\s*plus\b|กสิกรไทย/i,
  scb: /\bscb\b|siam commercial|ไทยพาณิชย์/i,
  bbl: /bangkok bank|ธนาคารกรุงเทพ/i,
  ktb: /krung\s*thai|\bktb\b|กรุงไทย/i,
  krungsri: /krungsri|bank of ayudhya|กรุงศรี/i,
  ttb: /\bttb\b|tmbthanachart|ทหารไทยธนชาต/i,
  gsb: /\bgsb\b|government savings bank|ออมสิน/i,
};

/** Header-only detection avoids treating a transfer recipient as the issuing bank. */
export function detectStatementBank(lines: readonly PdfTextLine[]): StatementBankId | null {
  const firstTransaction = lines.findIndex((line) => /^\s*[\d๐-๙]{1,2}[/ .-]/.test(line.text));
  const header = lines.slice(0, firstTransaction < 0 ? 30 : Math.min(firstTransaction, 30)).map((line) => line.text).join(" ");
  return (Object.keys(HEADERS) as StatementBankId[]).find((id) => HEADERS[id].test(header)) ?? null;
}

const generic: StatementProfile = {
  creditHints: COMMON_CREDIT_HINTS,
  debitHints: COMMON_DEBIT_HINTS,
  openingBalancePatterns: COMMON_OPENING_PATTERNS,
  skipPatterns: COMMON_SKIP_PATTERNS,
  threeAmountOrder: ["debit", "credit"],
};

/**
 * ALL bank profiles are best-effort heuristics, not certified bank integrations.
 * Export layouts vary by app/version/account. Positioned column headers take
 * priority; the profile's order applies only to three-amount text-only rows.
 * Every extracted row must pass the existing mapping and review flow.
 */
export const BANK_PROFILES: Record<StatementBankId, StatementProfile> = {
  // KBank / K PLUS — best-effort transaction vocabulary.
  kbank: { ...generic, creditHints: [...COMMON_CREDIT_HINTS, /รับเงิน|รับโอนเงิน/], debitHints: [...COMMON_DEBIT_HINTS, /โอนเงิน|โอนผ่าน/ ] },
  // SCB — best-effort Easy statement vocabulary.
  scb: { ...generic, creditHints: [...COMMON_CREDIT_HINTS, /credit interest/i], debitHints: [...COMMON_DEBIT_HINTS, /paid|ตัดบัญชี/i] },
  // Bangkok Bank — best-effort English/Thai deposit statement.
  bbl: { ...generic, creditHints: [...COMMON_CREDIT_HINTS, /\bCDM\b/], debitHints: [...COMMON_DEBIT_HINTS, /\bWD\b/] },
  // Krungthai — best-effort NEXT statement vocabulary.
  ktb: { ...generic, creditHints: [...COMMON_CREDIT_HINTS, /รับเงินผ่าน/], debitHints: [...COMMON_DEBIT_HINTS, /โอนเงิน/] },
  // Krungsri — best-effort deposit/withdrawal statement.
  krungsri: { ...generic, creditHints: [...COMMON_CREDIT_HINTS, /เงินฝาก/], debitHints: [...COMMON_DEBIT_HINTS, /ชำระสินค้า/] },
  // TTB — best-effort TMB/Thanachart statement vocabulary.
  ttb: { ...generic, creditHints: [...COMMON_CREDIT_HINTS, /\bcredit transfer\b/i], debitHints: [...COMMON_DEBIT_HINTS, /\bdebit transfer\b/i] },
  // GSB — best-effort MyMo / savings statement vocabulary.
  gsb: { ...generic, creditHints: [...COMMON_CREDIT_HINTS, /นำฝาก/], debitHints: [...COMMON_DEBIT_HINTS, /ถอนผ่าน/] },
};

export function parseBankStatement(lines: readonly PdfTextLine[], bank: StatementBankId, refYear: number) {
  return runStatementEngine(lines, BANK_PROFILES[bank], refYear);
}

export function parseGenericStatement(lines: readonly PdfTextLine[], refYear: number) {
  return runStatementEngine(lines, generic, refYear);
}

export function parsePdfStatement(lines: readonly PdfTextLine[], refYear: number): StatementParseResult {
  const detectedBank = detectStatementBank(lines);
  if (detectedBank) {
    const result = parseBankStatement(lines, detectedBank, refYear);
    if (result.rows.length) return { ...result, parser: detectedBank, detectedBank };
  }
  const result = parseGenericStatement(lines, refYear);
  if (!result.rows.length) throw new PdfImportError("unrecognized_layout", "ไม่รู้จักรูปแบบ statement นี้ ลองส่งออกเป็น CSV จากแอปธนาคาร / Unrecognized statement layout; try CSV.");
  return { ...result, parser: "generic", detectedBank };
}
