"use client";

import { useState, useTransition } from "react";
import {
  ArrowLeftRight,
  MoreVertical,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import type { Account, Category, TransactionType } from "@/types/database";
import type { TransactionWithRelations } from "@/features/transactions/queries";
import { deleteTransaction } from "@/features/transactions/actions";
import { asTrigger } from "@/lib/as-trigger";
import { formatMoneyFromDecimal } from "@/lib/financial/money";
import { formatFriendlyDate } from "@/lib/transaction-ui";
import { useTranslation } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TransactionForm } from "./transaction-form";

const TYPE_ICONS: Record<TransactionType, React.ElementType> = {
  income: TrendingUp,
  expense: TrendingDown,
  refund: RotateCcw,
  debt_payment: TrendingDown,
  savings_transfer: ArrowLeftRight,
  investment_allocation: ArrowLeftRight,
  transfer: ArrowLeftRight,
};

const CREDIT_TYPES: TransactionType[] = ["income", "refund"];

interface TransactionRowProps {
  transaction: TransactionWithRelations;
  accounts: Account[];
  categories: Category[];
}

export function TransactionRow({ transaction, accounts, categories }: TransactionRowProps) {
  const { t, locale } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const Icon = TYPE_ICONS[transaction.type];
  const isCredit = CREDIT_TYPES.includes(transaction.type);
  const isTransfer = transaction.type === "transfer";

  const accountLabel = isTransfer
    ? `${transaction.from_account?.name ?? "?"} → ${transaction.to_account?.name ?? "?"}`
    : transaction.account?.name ?? "—";

  const categoryName = transaction.category
    ? locale === "th"
      ? transaction.category.name_th
      : transaction.category.name_en
    : null;

  const title =
    transaction.description ||
    transaction.merchant ||
    categoryName ||
    t(`transactions.types.${transaction.type}`);

  return (
    <div className="flex items-center justify-between gap-3 border-b py-3 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium leading-none">{title}</p>
          <p className="mt-1 flex items-center gap-1 truncate text-sm text-muted-foreground">
            <Wallet className="h-3 w-3 shrink-0" aria-hidden="true" />
            {accountLabel} ·{" "}
            {formatFriendlyDate(transaction.transaction_date, locale, {
              today: t("transactions.today"),
              yesterday: t("transactions.yesterday"),
            })}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <p className={isCredit ? "font-semibold text-emerald-600 dark:text-emerald-400" : "font-semibold"}>
          {isCredit ? "+" : isTransfer ? "" : "-"}
          {formatMoneyFromDecimal(transaction.amount, transaction.currency_code)}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger
            {...asTrigger(
              <Button variant="ghost" size="icon" aria-label={t("common.moreActions")}>
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          />
          <DropdownMenuContent align="end">
            {!isTransfer && (
              <DropdownMenuItem onClick={() => setEditOpen(true)}>{t("common.edit")}</DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant="destructive"
              disabled={isPending}
              onClick={() => {
                if (typeof window !== "undefined" && !window.confirm(t("transactions.deleteConfirm"))) {
                  return;
                }
                startTransition(async () => {
                  await deleteTransaction(transaction.id);
                });
              }}
            >
              {t("common.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!isTransfer && (
        <TransactionForm
          defaultType={transaction.type as Exclude<TransactionType, "transfer">}
          accounts={accounts}
          categories={categories}
          transaction={transaction}
          trigger={null}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </div>
  );
}
