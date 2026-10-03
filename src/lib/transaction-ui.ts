import type { AccountType, TransactionType } from "@/types/database";

/**
 * Maps the `categories.icon` values seeded in
 * supabase/migrations/0002_system_categories.sql to a display emoji. Emoji
 * are used instead of the Lucide icon names directly because they scan
 * faster in a dense grid and need no icon font/sprite loading.
 */
export const CATEGORY_ICON_EMOJI: Record<string, string> = {
  utensils: "🍜",
  car: "🚕",
  home: "🏠",
  "shopping-bag": "🛍️",
  "heart-pulse": "💊",
  film: "🎮",
  "graduation-cap": "📚",
  "plug-zap": "💡",
  repeat: "📱",
  shield: "🛡️",
  users: "👨‍👩‍👧",
  "more-horizontal": "✨",
  wallet: "💰",
  laptop: "💻",
  briefcase: "💼",
  gift: "🎁",
  percent: "📈",
  landmark: "🏦",
  "rotate-ccw": "↩️",
};

export function categoryEmoji(icon: string | null): string {
  if (!icon) return "🏷️";
  return CATEGORY_ICON_EMOJI[icon] ?? "🏷️";
}

export const ACCOUNT_TYPE_EMOJI: Record<AccountType, string> = {
  cash: "💵",
  bank: "💳",
  savings: "🏦",
  e_wallet: "📱",
  credit_card: "💳",
  investment: "📈",
  other: "🗂️",
};

interface TransactionTypeVisual {
  emoji: string;
  colorClass: string;
}

/** Expense/income/transfer are never distinguished by color alone — always paired with this emoji + a text label from the i18n dictionary. */
export const TRANSACTION_TYPE_VISUAL: Record<"expense" | "income" | "transfer", TransactionTypeVisual> = {
  expense: { emoji: "🔴", colorClass: "text-rose-600 dark:text-rose-400" },
  income: { emoji: "🟢", colorClass: "text-emerald-600 dark:text-emerald-400" },
  transfer: { emoji: "🔵", colorClass: "text-sky-600 dark:text-sky-400" },
};

/** Non-transfer, non-income/expense types (refund, debt_payment, ...) fall back to a neutral look. */
export function transactionTypeVisual(type: TransactionType): TransactionTypeVisual {
  if (type === "expense" || type === "income" || type === "transfer") {
    return TRANSACTION_TYPE_VISUAL[type];
  }
  return { emoji: "⚪", colorClass: "text-foreground" };
}

/**
 * Friendly relative date label: "Today"/"Yesterday" (translated) for the
 * last two days, otherwise a locale-formatted short date — never a raw
 * mm/dd/yyyy the user has to parse.
 */
export function formatFriendlyDate(
  isoDate: string,
  locale: "th" | "en",
  labels: { today: string; yesterday: string }
): string {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((date.getTime() - today.getTime()) / dayMs);

  if (diffDays === 0) return labels.today;
  if (diffDays === -1) return labels.yesterday;

  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export interface TransactionDayGroup<T> {
  /** YYYY-MM-DD */
  date: string;
  items: T[];
}

export interface TransactionMonthGroup<T> {
  /** YYYY-MM */
  month: string;
  days: TransactionDayGroup<T>[];
}

/**
 * Groups a date-sorted (newest first) list into month → day sections for
 * the transaction list. Keeps the input order within each day, and starts a
 * new section whenever the date changes, so it never reorders anything.
 */
export function groupTransactionsByMonthAndDay<T extends { transaction_date: string }>(
  transactions: T[]
): TransactionMonthGroup<T>[] {
  const months: TransactionMonthGroup<T>[] = [];
  for (const tx of transactions) {
    const date = tx.transaction_date.slice(0, 10);
    const month = date.slice(0, 7);
    let monthGroup = months[months.length - 1];
    if (!monthGroup || monthGroup.month !== month) {
      monthGroup = { month, days: [] };
      months.push(monthGroup);
    }
    let dayGroup = monthGroup.days[monthGroup.days.length - 1];
    if (!dayGroup || dayGroup.date !== date) {
      dayGroup = { date, items: [] };
      monthGroup.days.push(dayGroup);
    }
    dayGroup.items.push(tx);
  }
  return months;
}

/** "ตุลาคม 2569" / "October 2026" */
export function formatMonthHeading(month: string, locale: "th" | "en"): string {
  const date = new Date(`${month}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return month;
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { month: "long", year: "numeric" }).format(date);
}

/** Short weekday for a day heading, e.g. "พฤ." / "Thu" — the long Thai form ("วันพฤหัสบดี") repeats "วัน" after "วันที่ 20". */
export function formatWeekday(isoDate: string, locale: "th" | "en"): string {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { weekday: "short" }).format(date);
}
