import { formatMoney } from "@/lib/financial/money";

/** Whole baht when exact ("฿6,287"), two decimals otherwise ("฿89.50"). */
export function formatBaht(cents: number, signed?: "+" | "−"): string {
  const abs = Math.abs(cents);
  const text = formatMoney(abs, "THB", "th-TH", abs % 100 === 0 ? 0 : 2);
  return signed ? `${signed}${text}` : text;
}
