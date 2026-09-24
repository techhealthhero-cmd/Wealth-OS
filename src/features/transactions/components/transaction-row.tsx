"use client";

import { useState, useTransition } from "react";
import {
  ArrowLeftRight,
  ChevronDown,
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
import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirmDialog } from "@/components/shared/confirm-dialog";
import { TransactionForm } from "./transaction-form";
import { TransferForm } from "./transfer-form";

const TYPE_ICONS: Record<TransactionType, React.ElementType> = {
  income: TrendingUp,
  expense: TrendingDown,
  refund: RotateCcw,
  debt_payment: TrendingDown,
  savings_transfer: ArrowLeftRight,
  investment_allocation: ArrowLeftRight,
  transfer: ArrowLeftRight,
};

/**
 * Reported: every row's icon circle was the same neutral gray regardless of
 * type, hard to scan at a glance. Colors the same 3 icon-shape groups
 * TYPE_ICONS already defines (never color alone per transaction-ui.ts's own
 * "never distinguished by color alone" rule — the icon shape already
 * differs between groups, this only adds a second, reinforcing cue): money
 * in (income/refund) emerald, money out (expense/debt_payment) rose,
 * between-own-accounts (transfer/savings_transfer/investment_allocation)
 * sky — matches the bg-X-100/dark:bg-X-950 badge convention already used
 * elsewhere (e.g. goal-progress-card.tsx's SCHEDULE_BADGE_CLASS).
 */
const TYPE_ICON_BG_CLASS: Record<TransactionType, string> = {
  income: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  refund: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  expense: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
  debt_payment: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
  transfer: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
  savings_transfer: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
  investment_allocation: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
};

const CREDIT_TYPES: TransactionType[] = ["income", "refund"];

interface TransactionRowProps {
  transaction: TransactionWithRelations;
  accounts: Account[];
  categories: Category[];
  defaultDetailsOpen?: boolean;
}

export function TransactionRow({
  transaction,
  accounts,
  categories,
  defaultDetailsOpen = false,
}: TransactionRowProps) {
  const { t, locale } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(defaultDetailsOpen);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const Icon = TYPE_ICONS[transaction.type];
  const isCredit = CREDIT_TYPES.includes(transaction.type);
  const isTransfer = transaction.type === "transfer";
  const hasNotes = Boolean(transaction.notes?.trim());

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

  const rowContent = (
    <>
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          TYPE_ICON_BG_CLASS[transaction.type]
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        {/* leading-tight, not leading-none: Thai tone marks/vowels stack
            above and below the consonant (e.g. ไม้เอก, สระอุ) and get
            visually clipped at line-height:1 — reported as merchant/goal/
            account names appearing "chipped". Same fix applied to every
            other truncated title using this pattern (account/asset/goal/
            income-source/liability/recurring/skill/subscription cards). */}
        <p className="truncate font-medium leading-tight">{title}</p>
        <p className="mt-1 flex items-center gap-1 truncate text-sm text-muted-foreground">
          <Wallet className="h-3 w-3 shrink-0" aria-hidden="true" />
          {accountLabel}
        </p>
      </div>
    </>
  );

  return (
    <div className="border-b py-3 last:border-0">
      <div className="flex items-center justify-between gap-3">
        {hasNotes ? (
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            aria-expanded={detailsOpen}
            className="flex min-w-0 items-center gap-3 text-left transition-transform duration-(--motion-fast) active:scale-[0.99]"
          >
            {rowContent}
          </button>
        ) : (
          <div className="flex min-w-0 items-center gap-3">{rowContent}</div>
        )}

        <div className="flex shrink-0 items-center gap-2">
          <p className={isCredit ? "font-semibold text-emerald-600 dark:text-emerald-400" : "font-semibold"}>
            {isCredit ? "+" : isTransfer ? "" : "-"}
            {formatMoneyFromDecimal(transaction.amount, transaction.currency_code)}
          </p>
          {hasNotes ? (
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-(--motion-normal) ease-(--ease-standard)",
                detailsOpen && "rotate-180"
              )}
              aria-hidden="true"
            />
          ) : null}
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
                  if (!(await confirm(t("transactions.deleteConfirm"), { destructive: true }))) return;
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
      </div>

      {hasNotes && detailsOpen ? (
        <div className="animate-in fade-in slide-in-from-top-1 duration-(--motion-normal) mt-2 ml-12 rounded-lg bg-muted/50 px-3 py-2 text-sm">
          <p className="text-xs font-medium text-muted-foreground">{t("transactions.notes")}</p>
          <p className="mt-0.5 break-words">{transaction.notes}</p>
        </div>
      ) : null}

      {isTransfer ? (
        <TransferForm
          accounts={accounts}
          transfer={transaction}
          trigger={null}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      ) : (
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
      {confirmDialog}
    </div>
  );
}
