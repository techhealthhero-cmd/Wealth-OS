/**
 * Spoken transfers between the user's OWN accounts —
 * "โอนเงินจากบัญชี Cash ไปบัญชี Dime 3000" → Cash → Dime ฿3,000.
 *
 * Pure and deterministic. A transfer needs two different accounts the user
 * really has, named in the words; "โอนเงินให้แม่ 500" (one account at most)
 * stays an ordinary expense. The one exception is a cash withdrawal
 * ("ถอนเงิน KBank 1000"), which goes into the user's cash account.
 */
import { ACCOUNT_HINTS } from "./keywords";
import { findKeyword, normalizeText, type CaptureAccount } from "./transaction-parser";

export interface TransferAccounts {
  fromAccountId: string;
  toAccountId: string;
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
const ACCOUNT_NOUNS = /\s*(?:บัญชี|กระเป๋า|account|wallet|my|the)\s*$/;

/** Every one of the user's accounts the words mention, in reading order (names first, then bank/payment hints). */
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

/** The two accounts of a spoken transfer, or null when the words aren't one. */
export function detectTransfer(input: string, accounts: CaptureAccount[]): TransferAccounts | null {
  const lower = normalizeText(input).toLowerCase();
  const mentions = findAccountMentions(lower, accounts);
  const distinct = mentions.filter((m, i) => mentions.findIndex((x) => x.accountId === m.accountId) === i);

  if (distinct.length === 1 && WITHDRAW.test(lower)) {
    // "ถอนเงิน KBank 1000": cash comes out of the bank into the wallet.
    const cash = accounts.find((a) => !a.is_archived && a.account_type === "cash");
    return cash && cash.id !== distinct[0].accountId ? { fromAccountId: distinct[0].accountId, toAccountId: cash.id } : null;
  }
  if (distinct.length < 2) return null;

  const [a, b] = distinct;
  const dirA = directionBefore(lower, a.start);
  const dirB = directionBefore(lower, b.start);
  // Without a transfer word, only "จาก X ไป Y" (both directions said) counts —
  // "กาแฟ 80 บัตร KBank" names two accounts but moves nothing between them.
  if (!TRANSFER_VERBS.test(lower) && !(dirA && dirB && dirA !== dirB)) return null;

  const bFirst = dirA === "to" || dirB === "from";
  return bFirst ? { fromAccountId: b.accountId, toAccountId: a.accountId } : { fromAccountId: a.accountId, toAccountId: b.accountId };
}
