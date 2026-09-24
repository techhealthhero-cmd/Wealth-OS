"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { Account, Category } from "@/types/database";
import type { TransactionFilters, TransactionWithRelations } from "@/features/transactions/queries";
import { loadMoreTransactions } from "@/features/transactions/actions";
import { useTranslation } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TransactionRow } from "./transaction-row";

interface TransactionListBodyProps {
  initialTransactions: TransactionWithRelations[];
  initialHasMore: boolean;
  filters: Omit<TransactionFilters, "limit" | "offset">;
  accounts: Account[];
  categories: Category[];
  defaultDetailsOpen?: boolean;
}

/**
 * Client half of the transaction list's pagination (perf audit finding —
 * see transaction-list.tsx and transactions/queries.ts's getTransactionsPage
 * doc comments for why this exists). The first page is still rendered
 * server-side by TransactionList for a fast first paint; this component
 * only owns what happens after that — appending further pages on demand,
 * never fetching more than the user actually asked to see.
 */
export function TransactionListBody({
  initialTransactions,
  initialHasMore,
  filters,
  accounts,
  categories,
  defaultDetailsOpen,
}: TransactionListBodyProps) {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startTransition] = useTransition();

  function handleLoadMore() {
    startTransition(async () => {
      const result = await loadMoreTransactions(filters, transactions.length);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setTransactions((prev) => [...prev, ...result.transactions]);
      setHasMore(result.hasMore);
    });
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="py-2">
          {transactions.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              accounts={accounts}
              categories={categories}
              defaultDetailsOpen={defaultDetailsOpen}
            />
          ))}
        </CardContent>
      </Card>
      {hasMore ? (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={isPending}>
            {isPending ? t("transactions.loadingMore") : t("transactions.loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
