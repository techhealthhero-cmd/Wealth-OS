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

export function RecurringTransactionCard({
  recurring,
  accounts,
  categories,
}: {
  recurring: RecurringTransaction;
  accounts: Account[];
  categories: Category[];
}) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const due = isDue(new Date(recurring.next_due_date));
  const overdue = isOverdue(new Date(recurring.next_due_date));

  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {/* leading-tight, not leading-none — see transaction-row.tsx's title for why (Thai tone-mark clipping). */}
              <p className="min-w-0 truncate font-medium leading-tight">{recurring.merchant || recurring.description || t(`recurring.types.${recurring.type}`)}</p>
              {overdue ? (
                <Badge className="shrink-0 bg-red-100 text-[10px] text-red-700 dark:bg-red-950 dark:text-red-400">
                  {t("upcomingBills.overdue")}
                </Badge>
              ) : !recurring.is_active ? (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {t("common.archive")}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {recurring.description?.trim() ? (
                recurring.description
              ) : (
                <>
                  {t(`recurring.types.${recurring.type}`)} · {t(`recurring.frequencies.${recurring.frequency}`)} · {t("recurring.nextDue")}:{" "}
                  {recurring.next_due_date}
                </>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <p className="font-medium">{formatMoneyFromDecimal(recurring.amount)}</p>
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
