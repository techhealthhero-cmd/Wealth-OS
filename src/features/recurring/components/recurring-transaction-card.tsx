"use client";

import { useState, useTransition } from "react";
import { MoreVertical } from "lucide-react";

import type { Account, Category, RecurringTransaction } from "@/types/database";
import { deleteRecurringTransaction, confirmRecurringTransaction } from "@/features/recurring/actions";
import { isDue, isOverdue } from "@/lib/financial/recurring";
import { useTranslation } from "@/i18n/client";
import { formatMoneyFromDecimal } from "@/lib/financial/money";
import { RecurringTransactionForm } from "./recurring-transaction-form";
import { asTrigger } from "@/lib/as-trigger";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";
import { KIND_DOT, formatDueDateWithYear } from "@/features/recurring/lib/payment-display";

export function RecurringTransactionCard({
  recurring,
  accounts,
  categories,
}: {
  recurring: RecurringTransaction;
  accounts: Account[];
  categories: Category[];
}) {
  const { t, locale } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const due = isDue(new Date(recurring.next_due_date));
  const overdue = isOverdue(new Date(recurring.next_due_date));
  const dueToday = due && !overdue;

  return (
    <Card>
      <CardContent className="space-y-2 pr-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {/* Same type colour as the payment calendar's dots. */}
            <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", KIND_DOT[recurring.type])} />
            {/* leading-tight, not leading-none — see transaction-row.tsx's title for why (Thai tone-mark clipping). */}
            <p className="min-w-0 truncate font-medium leading-tight">{recurring.merchant || recurring.description || t(`recurring.types.${recurring.type}`)}</p>
            {overdue ? (
              <Badge className="shrink-0 bg-red-100 text-[10px] text-red-700 dark:bg-red-950 dark:text-red-400">
                {t("upcomingBills.overdue")}
              </Badge>
            ) : dueToday && recurring.is_active ? (
              <Badge className="shrink-0 bg-[#f6e3dc] text-[10px] text-[#9b4538] dark:bg-[#e0907f]/15 dark:text-[#f0b3a6]">
                {t("paymentCalendar.dueToday")}
              </Badge>
            ) : !recurring.is_active ? (
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                {t("common.archive")}
              </Badge>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <p className="font-medium tabular-nums">{formatMoneyFromDecimal(recurring.amount)}</p>
            <DropdownMenu>
              <DropdownMenuTrigger
                {...asTrigger(
                  <Button variant="ghost" size="icon" aria-label={t("common.moreActions")}>
                    <MoreVertical className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>{t("common.edit")}</DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  disabled={isPending}
                  onClick={async () => {
                    if (!(await confirm(t("recurring.deleteConfirm"), { destructive: true }))) return;
                    startTransition(async () => {
                      await deleteRecurringTransaction(recurring.id);
                    });
                  }}
                >
                  {t("common.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {/* Own full-width line so it isn't truncated beside the amount at 390px. */}
        <p className="-mt-1 truncate pl-4 text-sm leading-5 text-muted-foreground">
          {recurring.description?.trim() ? (
            recurring.description
          ) : (
            <>
              {t(`recurring.types.${recurring.type}`)} · {t(`recurring.frequencies.${recurring.frequency}`)} · {t("recurring.nextDue")}:{" "}
              {formatDueDateWithYear(recurring.next_due_date, locale)}
            </>
          )}
        </p>

        {due && recurring.is_active ? (
          <Button
            size="sm"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await confirmRecurringTransaction(recurring.id);
              })
            }
          >
            {isPending ? t("common.saving") : t("recurring.confirmButton")}
          </Button>
        ) : null}
      </CardContent>
      <RecurringTransactionForm recurring={recurring} accounts={accounts} categories={categories} trigger={null} open={editOpen} onOpenChange={setEditOpen} />
      {confirmDialog}
    </Card>
  );
}
