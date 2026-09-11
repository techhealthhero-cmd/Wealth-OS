import { getAccounts } from "@/features/accounts/queries";
import { getCategories } from "@/features/categories/queries";
import { getProfile } from "@/features/profile/queries";
import {
  getQuickRepeatCandidates,
  getTransactions,
  type TransactionFilters,
} from "@/features/transactions/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { EmptyState } from "@/components/shared/empty-state";
import { EmptyTransactionsIllustration } from "@/components/illustrations";
import { TransactionRow } from "./transaction-row";
import { TransactionFilters as TransactionFiltersBar } from "./transaction-filters";
import { QuickAdd } from "./quick-add";
import { QuickRepeat } from "./quick-repeat";
import { Card, CardContent } from "@/components/ui/card";

export async function TransactionList({ filters }: { filters: TransactionFilters }) {
  const isDefaultView = !filters.search && !filters.type && !filters.accountId && !filters.categoryId;
  const [transactions, accounts, categories, profile, quickRepeatCandidates] = await Promise.all([
    getTransactions(filters),
    getAccounts({ includeArchived: true }),
    getCategories(),
    getProfile(),
    isDefaultView ? getQuickRepeatCandidates() : Promise.resolve([]),
  ]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TransactionFiltersBar accounts={accounts} categories={categories} />
        <div className="shrink-0">
          <QuickAdd accounts={accounts} categories={categories} variant="inline" />
        </div>
      </div>

      {isDefaultView ? (
        <QuickRepeat candidates={quickRepeatCandidates} accounts={accounts} categories={categories} />
      ) : null}

      {transactions.length === 0 ? (
        <EmptyState
          illustration={<EmptyTransactionsIllustration size={140} />}
          title={dict.transactions.emptyState}
          description={dict.transactions.noTransactionsFound}
        />
      ) : (
        <Card>
          <CardContent className="py-2">
            {transactions.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                accounts={accounts}
                categories={categories}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
