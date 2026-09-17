import type { TransactionWithRelations } from "@/features/transactions/queries";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

/**
 * Pro-only data export (`FEATURES.DATA_EXPORT` — see billing/plans.ts).
 * Deliberately a pure, dependency-free formatter — same "pure core, thin
 * I/O wrapper" convention as src/lib/financial/*.ts — so it's directly
 * unit-testable without mocking Supabase or a Response object. The route
 * handler (src/app/api/export/transactions/route.ts) does the auth/gate/
 * fetch and wraps this string in a file-download response.
 *
 * Amount is exported as the raw decimal string (e.g. "150.00"), never a
 * ฿-formatted/comma-grouped display string — a CSV opened in a spreadsheet
 * needs a value it can sum/chart directly, not display formatting.
 */
export function transactionsToCsv(
  transactions: TransactionWithRelations[],
  dict: Dictionary,
  locale: Locale
): string {
  const headers = [
    dict.export.columnDate,
    dict.export.columnType,
    dict.export.columnAmount,
    dict.export.columnCurrency,
    dict.export.columnAccount,
    dict.export.columnCategory,
    dict.export.columnMerchant,
    dict.export.columnDescription,
    dict.export.columnNotes,
  ];

  const rows = transactions.map((t) => {
    const typeLabel = dict.transactions.types[t.type];
    const accountLabel =
      t.type === "transfer"
        ? `${t.from_account?.name ?? ""} → ${t.to_account?.name ?? ""}`
        : (t.account?.name ?? "");
    const categoryLabel = t.category ? (locale === "th" ? t.category.name_th : t.category.name_en) : "";

    return [
      t.transaction_date,
      typeLabel,
      t.amount,
      t.currency_code,
      accountLabel,
      categoryLabel,
      t.merchant ?? "",
      t.description ?? "",
      t.notes ?? "",
    ];
  });

  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
