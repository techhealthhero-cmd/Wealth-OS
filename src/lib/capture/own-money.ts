/**
 * Money the user moved to themselves: a wallet top-up, a transfer between
 * their own accounts, or a slip whose receiver is their own name.
 *
 * These are not income and not spending. When both accounts are known they
 * are a real transfer (one account down, the other up). Otherwise they keep
 * the "โอนตัวเอง/เติมกระเป๋า" category and are stored as type `transfer` so
 * every expense/income total skips them.
 */
import { accountsMatchingMask, payerAccountMask, type MaskedAccount } from "./receipt-normalize";
import type { CaptureAccount } from "./transaction-parser";

export const OWN_MONEY_NAME_TH = "โอนตัวเอง/เติมกระเป๋า";
export const OWN_MONEY_NAME_EN = "Own transfer";
export const OWN_MONEY_ICON = "wallet-topup";

const TITLE =
  /^(?:นางสาว|นาย|นาง|น\.?\s*ส\.?|ด\.?\s*ช\.?|ด\.?\s*ญ\.?|miss|mrs|mr|ms)\.?\s+/iu;

/** Airtime and phone-bill top-ups are spending, not a move of the user's own money. */
const AIRTIME =
  /เติม(?:เงิน)?\s*(?:มือถือ|โทรศัพท์|เน็ต|อินเทอร์เน็ต|ais|dtac|true\s*move|ทรูมูฟ|เอไอเอส|ดีแทค)/i;
/** The shop itself is a phone carrier, so "เติมเงิน" on that slip is airtime. */
const PHONE_MERCHANT = /มือถือ|โทรศัพท์|true\s*move|ทรูมูฟ|เอไอเอส|\bais\b|dtac|ดีแทค/i;

const WALLET_BILLER: readonly RegExp[] = [
  /พร้อมเพย์[\s-]*อี[\s-]*วอลเล็?ต/i,
  /g[\s-]*wallet/i,
  /เป๋าตัง/,
  /true\s*money\s*wallet/i,
  /ทรู\s*มันนี่?\s*(?:วอลเล็?ต|วอลเลท)/,
  /shopee\s*pay|ช้อปปี้\s*เพย์|ช้อปปี้เพย์/i,
  /rabbit\s*line\s*pay|แรบบิท\s*ไลน์\s*เพย์/i,
  /(?:^|[\s/])line\s*pay(?:$|[\s/])|ไลน์\s*เพย์/i,
];

const TOPUP_NOTE = /เติมเป๋าตัง|เติมเงิน|top\s*-?\s*up|ท็อปอัพ|topup/i;

const SELF_MEMO =
  /โอนไปบัญชีหลัก|โอนเข้าบัญชี(?:ตัวเอง|ตนเอง|ของฉัน)|ย้ายเงิน|โอนให้(?:ตัวเอง|ตนเอง)|โอนเงินตัวเอง|to my own account|transfer to myself/i;

const WALLET_ACCOUNTS: readonly { re: RegExp; words: readonly string[] }[] = [
  { re: /g[\s-]*wallet|เป๋าตัง/i, words: ["g-wallet", "gwallet", "เป๋าตัง", "paotang"] },
  { re: /true\s*money|ทรู\s*มันนี่/i, words: ["truemoney", "true money", "true wallet", "ทรูมันนี่"] },
  { re: /shopee\s*pay|ช้อปปี้เพย์|ช้อปปี้\s*เพย์/i, words: ["shopeepay", "shopee pay", "ช้อปปี้เพย์"] },
  { re: /line\s*pay|ไลน์\s*เพย์|rabbit|แรบบิท/i, words: ["line pay", "linepay", "rabbit", "ไลน์เพย์"] },
];

export interface OwnMoneyCategory {
  id: string;
  type: string;
  name_en: string;
  name_th?: string;
  icon: string | null;
}

export function isOwnMoneyCategory(
  category: { type?: string; name_en?: string; icon?: string | null } | null | undefined
): boolean {
  if (!category) return false;
  return category.type === "transfer" || category.icon === OWN_MONEY_ICON || category.name_en === OWN_MONEY_NAME_EN;
}

export function ownMoneyCategory<T extends OwnMoneyCategory>(categories: readonly T[]): T | null {
  return (
    categories.find((c) => c.type === "transfer" && (c.icon === OWN_MONEY_ICON || c.name_en === OWN_MONEY_NAME_EN)) ??
    categories.find((c) => c.type === "transfer") ??
    categories.find((c) => c.icon === OWN_MONEY_ICON || c.name_en === OWN_MONEY_NAME_EN) ??
    null
  );
}

/** Expense pickers also offer the own-money category. Income pickers do not. */
export function categoriesForExpensePicker<T extends { type: string }>(categories: readonly T[]): T[] {
  return categories.filter((c) => c.type === "expense" || c.type === "both" || c.type === "transfer");
}

/** "จาก บัญชี A → บัญชี B" — the names are the accounts'. */
export function transferRouteLabel(from: string, to: string): string {
  return `จาก ${from} → ${to}`;
}

/** Titles, spaces and masked chunks ("xxx") removed, so two printings of one name compare. */
export function personNameKey(name: string): string {
  let text = name.normalize("NFC").replace(/\u200b/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  text = text.replace(/(?:[x*•●]{2,}[\s.\-]*)+/gi, " ").replace(/\s+/g, " ").trim();
  let previous = "";
  while (text && text !== previous) {
    previous = text;
    text = text.replace(TITLE, "").trim();
  }
  return text.replace(/\s+/g, "");
}

/**
 * The same person, allowing a slip that cuts the name short
 * ("นาย พุฒิพงศ์ บ" vs "นาย พุฒิพงศ์ บำรุงรักษ์") or hides part of it.
 */
export function samePerson(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const left = personNameKey(a);
  const right = personNameKey(b);
  if (left.length < 4 || right.length < 4) return false;
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  return longer.startsWith(shorter);
}

export function isWalletTopUp(merchant: string | null | undefined, note: string | null | undefined): boolean {
  const blob = `${merchant ?? ""}\n${note ?? ""}`;
  if (AIRTIME.test(blob)) return false;
  if (merchant && PHONE_MERCHANT.test(merchant) && !WALLET_BILLER.some((pattern) => pattern.test(merchant))) return false;
  if (merchant && WALLET_BILLER.some((pattern) => pattern.test(merchant))) return true;
  return Boolean(note && TOPUP_NOTE.test(note) && !(merchant && AIRTIME.test(merchant)));
}

export function isSelfTransferMemo(note: string | null | undefined): boolean {
  return Boolean(note && SELF_MEMO.test(note));
}

export interface SlipMovementInput {
  merchant: string | null;
  note: string | null;
  senderName: string | null;
  payerAccount: string | null;
  receiverAccount: string | null;
  receiverBank: string | null;
  amountCents: number | null;
}

export interface SlipMovement {
  ownMoney: boolean;
  fromAccountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  /** Receiver bank + mask, when the destination isn't one of the user's accounts yet. */
  unsavedReceiver: { name: string | null; bank: string | null; mask: string } | null;
}

function walletAccountId(
  merchant: string | null,
  note: string | null,
  accounts: readonly CaptureAccount[],
  fromId: string | null
): string | null {
  const text = `${merchant ?? ""} ${note ?? ""}`;
  const hint = WALLET_ACCOUNTS.find((item) => item.re.test(text));
  if (!hint) return null;
  const hits = accounts.filter((account) => {
    if (account.is_archived || account.id === fromId || account.account_type !== "e_wallet") return false;
    const haystack = `${account.name} ${account.institution ?? ""}`.toLowerCase();
    return hint.words.some((word) => haystack.includes(word.toLowerCase()));
  });
  return hits.length === 1 ? hits[0].id : null;
}

function oneAccount(mask: string | null, accounts: readonly MaskedAccount[]): string | null {
  const hits = accountsMatchingMask(mask, accounts);
  return hits.length === 1 ? hits[0].id : null;
}

/**
 * What this slip did with the user's own money. `ownMoney` is false for an
 * ordinary payment. A confident caller still has to have read an amount.
 */
export function classifySlipMovement(
  input: SlipMovementInput,
  accounts: readonly CaptureAccount[],
  categories: readonly OwnMoneyCategory[],
  ownerName: string | null
): SlipMovement {
  const none: SlipMovement = { ownMoney: false, fromAccountId: null, toAccountId: null, categoryId: null, unsavedReceiver: null };
  const fromAccountId = oneAccount(input.payerAccount, accounts);
  const maskedTo = oneAccount(input.receiverAccount, accounts);
  const wallet = isWalletTopUp(input.merchant, input.note);
  const memo = isSelfTransferMemo(input.note);
  const named =
    samePerson(input.merchant, ownerName) || samePerson(input.merchant, input.senderName);
  const bothAccounts = Boolean(fromAccountId && maskedTo && fromAccountId !== maskedTo);
  const ownMoney = bothAccounts || wallet || memo || named;
  if (!ownMoney) return { ...none, fromAccountId };

  const walletTo = wallet ? walletAccountId(input.merchant, input.note, accounts, fromAccountId) : null;
  const toAccountId = bothAccounts ? maskedTo : walletTo;
  const category = ownMoneyCategory(categories);
  const receiverMask = payerAccountMask(input.receiverAccount);
  const offerSave = !toAccountId && !wallet && Boolean(receiverMask) && (named || memo);
  return {
    ownMoney: true,
    fromAccountId,
    toAccountId,
    categoryId: category?.id ?? null,
    unsavedReceiver: offerSave && receiverMask ? { name: input.merchant, bank: input.receiverBank, mask: receiverMask } : null,
  };
}
