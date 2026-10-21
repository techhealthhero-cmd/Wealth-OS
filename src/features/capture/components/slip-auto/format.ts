import type { SlipCategoryIcon } from "./types";
import { formatMoney } from "@/lib/financial/money";

/** Whole baht when exact ("฿6,287"), two decimals otherwise ("฿89.50"). */
export function formatBaht(cents: number, signed?: "+" | "−"): string {
  const abs = Math.abs(cents);
  const text = formatMoney(abs, "THB", "th-TH", abs % 100 === 0 ? 0 : 2);
  return signed ? `${signed}${text}` : text;
}

export function slipCategoryIcon(name: string): SlipCategoryIcon {
  if (/food|อาหาร|drink|coffee/i.test(name)) return "food";
  if (/transport|เดินทาง/i.test(name)) return "go";
  if (/home|บ้าน|utilities|bills/i.test(name)) return "home";
  if (/shop|ซื้อของ/i.test(name)) return "shop";
  return "other";
}

export function monthLabel(date: string): string {
  return new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date.slice(0, 7)}-01T00:00:00Z`));
}
