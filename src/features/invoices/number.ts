/** Advisory only: the database unique index resolves concurrent number selection. */
export function suggestNextInvoiceNumber(existing: readonly string[], gregorianYear: number): string {
  if (!Number.isInteger(gregorianYear) || gregorianYear < 2020 || gregorianYear > 2100) throw new Error("Invalid year");
  const prefix = `INV-${gregorianYear + 543}-`;
  const max = existing.reduce((max, value) => {
    const suffix = value.startsWith(prefix) ? value.slice(prefix.length) : "";
    return /^\d{3,}$/.test(suffix) && Number.isSafeInteger(Number(suffix)) ? Math.max(max, Number(suffix)) : max;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}
