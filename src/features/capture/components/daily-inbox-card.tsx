"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Inbox } from "lucide-react";

import type { Account, Category, Transaction } from "@/types/database";
import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatMoneyFromDecimal } from "@/lib/financial/money";
import { categoryEmoji, formatFriendlyDate } from "@/lib/transaction-ui";
import { CategoryPicker } from "@/features/transactions/components/category-picker";
import { TransactionForm } from "@/features/transactions/components/transaction-form";
import { confirmInboxTransaction } from "@/features/capture/actions";
import { SwipeToDelete } from "@/components/shared/swipe-to-delete";
import { useUndoableDelete } from "@/components/shared/use-undoable-delete";
import type { DailyInbox, InboxTransaction } from "@/features/capture/queries";
import { canBulkConfirm } from "@/lib/capture/inbox";

/** The full form edits a Transaction row — fill the columns the inbox query doesn't select with neutral values. */
function toEditableTransaction(item: InboxTransaction): Transaction {
  return {
    ...item,
    user_id: "",
    from_account_id: null,
    to_account_id: null,
    currency_code: "THB",
    notes: null,
    is_recurring: false,
    client_request_id: null,
    created_at: "",
    updated_at: "",
  };
}

function InboxItem({
  item,
  categories,
  accounts,
  onConfirmed,
  onDelete,
}: {
  item: InboxTransaction;
  categories: Category[];
  accounts: Account[];
  onConfirmed: (id: string) => void;
  onDelete: (item: InboxTransaction) => void;
}) {
  const { t, locale } = useTranslation();
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const category = categories.find((c) => c.id === item.category_id) ?? null;
  const relevant = useMemo(
    () => categories.filter((c) => c.type === item.type || c.type === "both"),
    [categories, item.type]
  );
  const unsure = item.ai_confidence !== "high";
  const label = item.description || item.merchant || t("capture.inbox.unknownMerchant");

  function confirm(categoryId?: string | null) {
    startTransition(async () => {
      const res = await confirmInboxTransaction(item.id, categoryId);
      if (res.success) onConfirmed(item.id);
      else toast.error(res.error ?? t("capture.saveFailed"));
    });
  }

  const decided = canBulkConfirm(item, categories);
  const date = formatFriendlyDate(item.transaction_date, locale, { today: t("capture.today"), yesterday: t("capture.yesterday") });

  // 2026-10-11 ("รอตรวจ" tab): one line per item — amount, what & when,
  // the category (tap = pick, and picking confirms), ✓ to confirm as is.
  return (
    <SwipeToDelete
      as="li"
      deleteLabel={t("capture.inbox.delete")}
      a11yLabel={`${t("capture.inbox.delete")}: ${label} ${formatMoneyFromDecimal(item.amount)}`}
      onDelete={() => onDelete(item)}
      // Swipe right = the full editor.
      editLabel={t("capture.edit")}
      onEdit={() => setEditing(true)}
    >
    <div className={cn("bg-card px-3 transition-opacity", pending && "opacity-50")}>
      <div className="flex items-center gap-2 py-2.5">
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-semibold tabular-nums", item.type === "income" && "text-emerald-600 dark:text-emerald-400")}>
            {item.type === "income" ? "+" : ""}
            {formatMoneyFromDecimal(item.amount)}
          </p>
          <p className="truncate text-xs text-muted-foreground" title={label}>
            {label} · {date}
            {item.source === "receipt" && item.ai_confidence !== "high" ? ` · ${t("capture.inbox.reason.scan")}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          aria-expanded={picking}
          aria-label={t("capture.inbox.changeCategory")}
          className={cn(
            "inline-flex max-w-[9rem] shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs",
            decided
              ? "border border-primary/40 font-medium text-primary"
              : "border border-dashed border-amber-500/80 bg-background text-amber-800 dark:text-amber-300"
          )}
        >
          {decided && category ? (
            <>
              <span aria-hidden="true">{categoryEmoji(category.icon ?? null)}</span>
              <span className="truncate">
                {locale === "th" ? category.name_th : category.name_en}
                {unsure ? " ?" : ""}
              </span>
            </>
          ) : (
            <span>? {t("capture.category")}</span>
          )}
        </button>
        <Button
          type="button"
          size="icon"
          className="size-9 shrink-0 rounded-full"
          aria-label={t("capture.inbox.confirm")}
          disabled={pending || !decided}
          onClick={() => confirm()}
        >
          <Check className="size-4" aria-hidden="true" />
        </Button>
      </div>
      {picking ? (
        <div className="pb-3">
          <CategoryPicker
            name={`__inbox_category_${item.id}`}
            categories={relevant}
            value={item.category_id}
            // Picking a category IS the review — confirm in the same tap.
            onValueChange={(id) => {
              setPicking(false);
              if (id) confirm(id);
            }}
          />
        </div>
      ) : null}
      <TransactionForm
        defaultType={item.type === "income" ? "income" : "expense"}
        accounts={accounts}
        categories={categories}
        transaction={toEditableTransaction(item)}
        trigger={null}
        open={editing}
        onOpenChange={setEditing}
      />
    </div>
    </SwipeToDelete>
  );
}

/**
 * Daily Inbox — "capture first, organize later". Lives at the top of
 * Money › Transactions (2026-10-11: moved off Home so recording, reviewing
 * and editing all happen on one page). Shows only items still marked
 * needs_review, with one-tap ✓, one-tap category fix (which also confirms),
 * or the full edit form. Confirmed items simply drop into the list below,
 * so the box disappears once nothing is left to review.
 */
export function DailyInboxCard({
  inbox,
  categories,
  accounts,
  onlyDate = null,
  emptyText,
}: {
  inbox: DailyInbox;
  categories: Category[];
  accounts: Account[];
  /** The week strip's selected day: show only that day's items. */
  onlyDate?: string | null;
  /** Shown when nothing (or nothing that day) needs review. */
  emptyText: string;
}) {
  const { t } = useTranslation();
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [confirmingAll, startConfirmAll] = useTransition();
  // Swiped-away items: hidden at once, deleted after the undo window.
  const { hiddenIds, deleteWithUndo } = useUndoableDelete({
    deleted: t("capture.inbox.deleted"),
    undo: t("capture.undo"),
    failed: t("capture.saveFailed"),
  });

  function deleteItem(item: InboxTransaction) {
    deleteWithUndo(
      item.id,
      `${item.description || item.merchant || t("capture.inbox.unknownMerchant")} · ${formatMoneyFromDecimal(item.amount)}`
    );
  }

  const visible = inbox.items.filter((i) => !hiddenIds.has(i.id));
  const pending = visible.filter(
    (i) => i.review_status === "needs_review" && !confirmedIds.has(i.id) && (onlyDate === null || i.transaction_date === onlyDate)
  );
  // Only complete items may be bulk-confirmed; undecided categories need a pick.
  const bulkConfirmable = pending.filter((i) => canBulkConfirm(i, categories));
  const needsPick = pending.length - bulkConfirmable.length;

  function markConfirmed(id: string) {
    setConfirmedIds((prev) => new Set(prev).add(id));
  }

  function confirmAll() {
    startConfirmAll(async () => {
      for (const item of bulkConfirmable) {
        const res = await confirmInboxTransaction(item.id);
        if (res.success) markConfirmed(item.id);
        else {
          toast.error(res.error ?? t("capture.saveFailed"));
          break;
        }
      }
    });
  }

  if (pending.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <section
      aria-labelledby="pending-inbox-title"
      className="space-y-3 rounded-2xl border border-dashed border-amber-400/70 bg-amber-500/10 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="pending-inbox-title"
          className="flex items-center gap-1.5 font-heading text-sm font-semibold text-amber-800 dark:text-amber-300"
        >
          <Inbox className="size-4" aria-hidden="true" />
          {t("capture.inbox.pending").replace("{count}", String(pending.length))}
        </h2>
        {pending.length >= 2 && bulkConfirmable.length > 0 ? (
          <Button type="button" size="sm" onClick={confirmAll} disabled={confirmingAll}>
            <Check className="mr-1 size-3.5" aria-hidden="true" />
            {bulkConfirmable.length === pending.length
              ? t("capture.inbox.confirmAll")
              : t("capture.inbox.confirmReady").replace("{count}", String(bulkConfirmable.length))}
          </Button>
        ) : null}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {needsPick > 0 && pending.length >= 2
          ? `${t("capture.inbox.needsPickHint").replace("{count}", String(needsPick))} · `
          : ""}
        {t("capture.inbox.swipeHint")}
      </p>

      <ul className="divide-y overflow-hidden rounded-xl border">
        {pending.map((item) => (
          <InboxItem key={item.id} item={item} categories={categories} accounts={accounts} onConfirmed={markConfirmed} onDelete={deleteItem} />
        ))}
      </ul>

    </section>
  );
}
