import { ArrowLeftRight, CreditCard, ReceiptText, type LucideIcon } from "lucide-react";

import type { PaymentKind } from "@/lib/financial/payment-calendar";

export const KIND_ICON: Record<PaymentKind, LucideIcon> = {
  expense: ReceiptText,
  transfer: ArrowLeftRight,
  liability: CreditCard,
};

/** Dot colour per payment kind — shared by the calendar, legend, upcoming list and recurring cards. */
export const KIND_DOT: Record<PaymentKind | "income", string> = {
  expense: "bg-[#5fb592] dark:bg-[#6cc39f]",
  transfer: "bg-[#204d3d] dark:bg-[#b5d8c6]",
  liability: "bg-[#b4574a] dark:bg-[#e0907f]",
  income: "bg-[#b99a65] dark:bg-[#d8bb84]",
};

/** Icon-tile tint per kind (upcoming list / Home card). */
export const KIND_TILE: Record<PaymentKind, string> = {
  expense: "bg-[#e2f2ea] text-[#2f7d5c] dark:bg-[#5fb592]/15 dark:text-[#8fd9b4]",
  transfer: "bg-[#e3ece7] text-[#204d3d] dark:bg-[#b5d8c6]/12 dark:text-[#b5d8c6]",
  liability: "bg-[#f6e3dc] text-[#9b4538] dark:bg-[#e0907f]/15 dark:text-[#f0b3a6]",
};

export function intlLocale(locale: "th" | "en") {
  return locale === "th" ? "th-TH" : "en-US";
}

function utcDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** "จ." / "Mon" — ICU's Thai "short" weekday is the full word ("จันทร์"), so Thai uses the abbreviation + "." */
export function formatShortWeekday(date: string, locale: "th" | "en") {
  if (locale === "th") {
    return `${new Intl.DateTimeFormat("th-TH", { weekday: "narrow", timeZone: "UTC" }).format(utcDate(date))}.`;
  }
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(utcDate(date));
}

/** "จ. 19 ต.ค." / "Mon, Oct 19" */
export function formatShortDueDate(date: string, locale: "th" | "en") {
  const dayMonth = new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", timeZone: "UTC" }).format(utcDate(date));
  return locale === "th" ? `${formatShortWeekday(date, locale)} ${dayMonth}` : `${formatShortWeekday(date, locale)}, ${dayMonth}`;
}

/** "2569" (Buddhist era, without the "พ.ศ." prefix) / "2026" */
export function formatYearNumber(date: string, locale: "th" | "en") {
  const parts = new Intl.DateTimeFormat(intlLocale(locale), { year: "numeric", timeZone: "UTC" }).formatToParts(utcDate(date));
  return parts.find((p) => p.type === "year")?.value ?? date.slice(0, 4);
}

/** "19 ต.ค. 69" / "Oct 19, 2026" — the recurring card's next-due date. */
export function formatDueDateWithYear(date: string, locale: "th" | "en") {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    year: locale === "th" ? "2-digit" : "numeric",
    timeZone: "UTC",
  }).format(utcDate(date));
}

export interface RelativeDayLabels {
  today: string;
  tomorrow: string;
  /** Contains {n}. */
  inDays: string;
  /** Contains {n}. */
  overdueDays: string;
}

/** วันนี้ / พรุ่งนี้ / อีก N วัน / เลยกำหนด N วัน */
export function relativeDayLabel(days: number, labels: RelativeDayLabels) {
  if (days === 0) return labels.today;
  if (days === 1) return labels.tomorrow;
  if (days < 0) return labels.overdueDays.replace("{n}", String(-days));
  return labels.inDays.replace("{n}", String(days));
}
