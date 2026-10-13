"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import type { Account, Category } from "@/types/database";
import type { TransactionFilters, TransactionWithRelations } from "@/features/transactions/queries";
import { loadMoreTransactions } from "@/features/transactions/actions";
import { useTranslation } from "@/i18n/client";
import {
  formatFriendlyDate,
  formatMonthHeading,
  formatWeekday,
  groupTransactionsByMonthAndDay,
} from "@/lib/transaction-ui";
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
  /** A month (YYYY-MM) whose heading is left out — the calendar above already names it. */
  unlabeledMonth?: string;
}

/**
 * Client half of the transaction list's pagination (perf audit finding —
 * see transaction-list.tsx and transactions/queries.ts's getTransactionsPage
 * doc comments for why this exists). The first page is still rendered
 * server-side by TransactionList for a fast first paint; this component
 * only owns what happens after that — appending further pages on demand,
 * never fetching more than the user actually asked to see.
 *
 * Requested (2026-10-03): rows are grouped under month → day headings
 * ("ตุลาคม 2569" → "วันที่ 20"). The swipe-to-delete / swipe-to-edit
 * gestures were removed on request (2026-10-13); edit and delete live in
 * each row's ⋮ menu only.
 */
export function TransactionListBody({
  initialTransactions,
  initialHasMore,
  filters,
  accounts,
  categories,
  defaultDetailsOpen,
  unlabeledMonth,
}: TransactionListBodyProps) {
  const { t, locale } = useTranslation();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startTransition] = useTransition();

  const groups = useMemo(() => groupTransactionsByMonthAndDay(transactions), [transactions]);

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

  function dayLabel(date: string) {
    const today = t("transactions.today");
    const yesterday = t("transactions.yesterday");
    const friendly = formatFriendlyDate(date, locale, { today, yesterday });
    if (friendly === today || friendly === yesterday) return friendly;
    return t("transactions.dayHeading").replace("{day}", String(Number(date.slice(8, 10))));
  }

  return (
    <div className="space-y-3">
      {groups.map((month) => (
        <section
          key={month.month}
          className="space-y-2"
          aria-label={month.month === unlabeledMonth ? formatMonthHeading(month.month, locale) : undefined}
        >
          {month.month === unlabeledMonth ? null : (
            <h2 className="px-1 font-heading text-base font-semibold">
              {/* Journal: month headings get the highlighter stroke, rows are ruled ledger lines. */}
              <span className="journal-heading">{formatMonthHeading(month.month, locale)}</span>
            </h2>
          )}
          <Card>
            <CardContent className="space-y-1 py-2">
              {month.days.map((day) => (
                <div key={day.date}>
                  <p className="flex items-baseline gap-2 pt-3 pb-1 text-sm font-semibold">
                    {dayLabel(day.date)}
                    <span className="text-xs font-normal text-muted-foreground">{formatWeekday(day.date, locale)}</span>
                  </p>
                  {day.items.map((transaction) => (
                    <div key={transaction.id} className="border-b border-dashed last:border-0">
                      <TransactionRow
                        transaction={transaction}
                        accounts={accounts}
                        categories={categories}
                        defaultDetailsOpen={defaultDetailsOpen}
                        divider={false}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      ))}

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
