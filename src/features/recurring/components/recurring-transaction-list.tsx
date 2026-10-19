import { getRecurringTransactions } from "@/features/recurring/queries";
import { getDisplayAccounts } from "@/features/accounts/queries";
import { getCategories } from "@/features/categories/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import type { Account, Category, RecurringTransaction } from "@/types/database";
import { RecurringTransactionForm } from "./recurring-transaction-form";
import { RecurringTransactionCard } from "./recurring-transaction-card";
import { EmptyState } from "@/components/shared/empty-state";
import { EmptyTransactionsIllustration } from "@/components/illustrations";

export async function RecurringTransactionList() {
  const [recurring, accounts, categories, profile] = await Promise.all([
    getRecurringTransactions(),
    getDisplayAccounts(),
    getCategories(),
    getProfile(),
  ]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  return (
    <RecurringTransactionListView
      recurring={recurring}
      accounts={accounts}
      categories={categories}
      labels={{ ...dict.recurring, allRecurring: dict.paymentCalendar.allRecurring }}
    />
  );
}

export interface RecurringTransactionListViewProps {
  recurring: RecurringTransaction[];
  accounts: Account[];
  categories: Category[];
  labels: { emptyTitle: string; emptyState: string; allRecurring: string };
}

/** Presentational list: header with count + add button, then one card per item (already sorted by next_due_date). */
export function RecurringTransactionListView({ recurring, accounts, categories, labels }: RecurringTransactionListViewProps) {
  if (recurring.length === 0) {
    return (
      <section id="all-recurring" className="scroll-mt-24">
        <EmptyState
          illustration={<EmptyTransactionsIllustration size={140} />}
          title={labels.emptyTitle}
          description={labels.emptyState}
          action={<RecurringTransactionForm accounts={accounts} categories={categories} />}
        />
      </section>
    );
  }

  return (
    <section id="all-recurring" aria-labelledby="all-recurring-title" className="scroll-mt-24 space-y-3 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <h2 id="all-recurring-title" className="text-[17px] leading-[26px] font-semibold">
          {labels.allRecurring}
          <span className="ml-1.5 text-[13px] font-medium text-muted-foreground tabular-nums">{recurring.length}</span>
        </h2>
        <RecurringTransactionForm accounts={accounts} categories={categories} />
      </div>
      <div className="grid gap-3">
        {recurring.map((r) => (
          <RecurringTransactionCard key={r.id} recurring={r} accounts={accounts} categories={categories} />
        ))}
      </div>
    </section>
  );
}
