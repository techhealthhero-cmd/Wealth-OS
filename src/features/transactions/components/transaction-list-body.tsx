"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import type { Account, Category } from "@/types/database";
import type { TransactionFilters, TransactionWithRelations } from "@/features/transactions/queries";
import { loadMoreTransactions } from "@/features/transactions/actions";
import { useTranslation } from "@/i18n/client";
import { formatMoneyFromDecimal } from "@/lib/financial/money";
import {
  formatFriendlyDate,
  formatMonthHeading,
  formatWeekday,
  groupTransactionsByMonthAndDay,
} from "@/lib/transaction-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SwipeToDelete } from "@/components/shared/swipe-to-delete";
import { useUndoableDelete } from "@/components/shared/use-undoable-delete";
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
 *
 * Requested (2026-10-03): rows are grouped under month → day headings
 * ("ตุลาคม 2569" → "วันที่ 20"). Swipe LEFT deletes with undo, exactly like
 * the Daily Inbox (same SwipeToDelete + useUndoableDelete); swipe RIGHT
 * opens the row's edit form.
 */
export function TransactionListBody({
  initialTransactions,
  initialHasMore,
  filters,
  accounts,
  categories,
  defaultDetailsOpen,
}: TransactionListBodyProps) {
  const { t, locale } = useTranslation();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startTransition] = useTransition();
  // Swipe right opens this row's edit form.
  const [editingId, setEditingId] = useState<string | null>(null);
  const { hiddenIds, deleteWithUndo } = useUndoableDelete({
    deleted: t("transactions.deleted"),
    undo: t("capture.undo"),
    failed: t("transactions.deleteFailed"),
  });

  const groups = useMemo(
    () => groupTransactionsByMonthAndDay(transactions.filter((tx) => !hiddenIds.has(tx.id))),
    [transactions, hiddenIds]
  );

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

  function rowTitle(tx: TransactionWithRelations) {
    const categoryName = tx.category ? (locale === "th" ? tx.category.name_th : tx.category.name_en) : null;
    return tx.description || tx.merchant || categoryName || t(`transactions.types.${tx.type}`);
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
      {groups.length > 0 ? <p className="px-1 text-[11px] text-muted-foreground">{t("transactions.swipeHint")}</p> : null}

      {groups.map((month) => (
        <section key={month.month} className="space-y-2">
          <h2 className="px-1 font-heading text-base font-semibold">{formatMonthHeading(month.month, locale)}</h2>
          <Card>
            <CardContent className="space-y-1 py-2">
              {month.days.map((day) => (
                <div key={day.date}>
                  <p className="flex items-baseline gap-2 pt-3 pb-1 text-sm font-semibold">
                    {dayLabel(day.date)}
                    <span className="text-xs font-normal text-muted-foreground">{formatWeekday(day.date, locale)}</span>
                  </p>
                  {day.items.map((transaction) => (
                    <SwipeToDelete
                      key={transaction.id}
                      className="border-b last:border-0"
                      deleteLabel={t("common.delete")}
                      a11yLabel={`${t("common.delete")}: ${rowTitle(transaction)} ${formatMoneyFromDecimal(transaction.amount, transaction.currency_code)}`}
                      onDelete={() =>
                        deleteWithUndo(
                          transaction.id,
                          `${rowTitle(transaction)} · ${formatMoneyFromDecimal(transaction.amount, transaction.currency_code)}`
                        )
                      }
                      editLabel={t("common.edit")}
                      onEdit={() => setEditingId(transaction.id)}
                    >
                      <div className="bg-card">
                        <TransactionRow
                          transaction={transaction}
                          accounts={accounts}
                          categories={categories}
                          defaultDetailsOpen={defaultDetailsOpen}
                          divider={false}
                          editOpen={editingId === transaction.id}
                          onEditOpenChange={(open) => setEditingId(open ? transaction.id : null)}
                        />
                      </div>
                    </SwipeToDelete>
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
