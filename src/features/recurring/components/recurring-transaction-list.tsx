import { getRecurringTransactions } from "@/features/recurring/queries";
import { getAccounts } from "@/features/accounts/queries";
import { getCategories } from "@/features/categories/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { RecurringTransactionForm } from "./recurring-transaction-form";
import { RecurringTransactionCard } from "./recurring-transaction-card";
import { EmptyState } from "@/components/shared/empty-state";
import { EmptyTransactionsIllustration } from "@/components/illustrations";

export async function RecurringTransactionList() {
  const [recurring, accounts, categories, profile] = await Promise.all([
    getRecurringTransactions(),
    getAccounts(),
    getCategories(),
    getProfile(),
  ]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  if (recurring.length === 0) {
    return (
      <EmptyState
        illustration={<EmptyTransactionsIllustration size={140} />}
        title={dict.recurring.emptyTitle}
        description={dict.recurring.emptyState}
        action={<RecurringTransactionForm accounts={accounts} categories={categories} />}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <RecurringTransactionForm accounts={accounts} categories={categories} />
      </div>
      <div className="grid gap-3">
        {recurring.map((r) => (
          <RecurringTransactionCard key={r.id} recurring={r} accounts={accounts} categories={categories} />
        ))}
      </div>
    </div>
  );
}
