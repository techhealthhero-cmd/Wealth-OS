import "server-only";

import { getAccounts } from "@/features/accounts/queries";
import { getPaymentCalendarSources, getRecurringTransactions } from "@/features/recurring/queries";
import { getEmergencyFund, getEssentialMonthlyExpenses } from "@/features/emergency-fund/queries";
import { getTaxJarSettings, getTaxJarSummary } from "@/features/tax-jar/queries";
import { invoiceContext, invoiceDbError } from "@/features/invoices/server-context";
import { calendarDateSchema } from "@/lib/validation/invoices-tax-jar";
import { computeSafeToSpendToday, SAFE_TO_SPEND_TODAY_FORMULA_STATUS } from "@/lib/financial/safe-to-spend-today";
import { calculateEmergencyFundTarget } from "@/lib/financial/emergency-fund";
import { calculateSetAside } from "@/lib/financial/tax-jar";
import { calculateNextDueDate } from "@/lib/financial/recurring";
import { parseMoneyToCents } from "@/lib/financial/money";
import { toLocalDateString } from "@/lib/date";

/** Read-only calculation; assumptions remain pending user approval. */
export async function getSafeToSpendToday(today: string) {
  if (!calendarDateSchema.safeParse(today).success) return { error: "Invalid calendar date" };
  const { supabase, user, dict } = await invoiceContext();
  if (!user) return { error: dict.common.pleaseLogin };
  const accounts = await getAccounts();
  if (!accounts.length) return { success: false as const, reason: "no_accounts" as const };
  const [paymentSources, recurring, emergency, essential, settings, summary] = await Promise.all([
    getPaymentCalendarSources(today), getRecurringTransactions(), getEmergencyFund(),
    getEssentialMonthlyExpenses(), getTaxJarSettings(), getTaxJarSummary(Number(today.slice(0, 4))),
  ]);
  let nextIncomeDate: string | null = null;
  for (const r of recurring) {
    if (r.type !== "income" || !r.is_active || (r.end_date && r.end_date < today)) continue;
    let date = r.next_due_date;
    while (date <= today) date = toLocalDateString(calculateNextDueDate(new Date(`${date}T00:00:00`), r.frequency));
    if (r.end_date && date > r.end_date) continue;
    if (!nextIncomeDate || date < nextIncomeDate) nextIncomeDate = date;
  }
  const warnings: string[] = [];
  let taxJar = null;
  const excludedAccountIds: string[] = [];
  if (emergency?.linked_account_id) excludedAccountIds.push(emergency.linked_account_id);
  if (settings.success && settings.settings.accountId) excludedAccountIds.push(settings.settings.accountId);
  if ("error" in settings || "error" in summary) warnings.push("tax_jar_unavailable");
  else if (settings.configured) {
    let incomeCents = 0;
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("transactions").select("amount")
        .eq("user_id", user.id).eq("type", "income")
        .gte("transaction_date", `${today.slice(0, 4)}-01-01`).lte("transaction_date", today)
        .order("id").range(offset, offset + 499);
      if (error) return { error: invoiceDbError(error, dict) };
      for (const row of data ?? []) {
        incomeCents += parseMoneyToCents(row.amount);
        if (!Number.isSafeInteger(incomeCents)) throw new Error("Expected safe integer satang");
      }
      if (!data || data.length < 500) break;
    }
    taxJar = { targetCents: calculateSetAside(incomeCents, settings.settings.ratePct), balanceCents: summary.balanceCents };
  }
  const result = computeSafeToSpendToday({
    today, liquidAccounts: accounts.filter(a => ["cash", "bank", "e_wallet"].includes(a.account_type))
      .map(a => ({ id: a.id, balanceCents: parseMoneyToCents(a.current_balance) })),
    excludedAccountIds, paymentSources, nextIncomeDate, taxJar,
    emergencyFund: emergency ? {
      targetCents: calculateEmergencyFundTarget(essential.cents, emergency.target_months === null ? null : Number(emergency.target_months),
        emergency.custom_target_amount === null ? null : parseMoneyToCents(emergency.custom_target_amount)),
      currentCents: parseMoneyToCents(emergency.current_amount), monthlyContributionCents: parseMoneyToCents(emergency.monthly_contribution),
    } : null,
  });
  return { success: true as const, ...result, warnings, assumptionsStatus: SAFE_TO_SPEND_TODAY_FORMULA_STATUS };
}
