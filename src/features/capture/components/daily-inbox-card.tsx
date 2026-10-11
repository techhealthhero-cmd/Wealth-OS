"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, Inbox, Pencil } from "lucide-react";

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
import { canBulkConfirm, inboxReviewReasons } from "@/lib/capture/inbox";

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

  return (
    <SwipeToDelete
      as="li"
      className="rounded-2xl"
      deleteLabel={t("capture.inbox.delete")}
      a11yLabel={`${t("capture.inbox.delete")}: ${label} ${formatMoneyFromDecimal(item.amount)}`}
      onDelete={() => onDelete(item)}
      // Swipe right = the same editor as the ✏️ button.
      editLabel={t("capture.edit")}
      onEdit={() => setEditing(true)}
    >
    <div className={cn("space-y-2 rounded-2xl border bg-card p-3 transition-opacity", pending && "opacity-50")}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className={cn("text-lg font-bold tabular-nums", item.type === "income" && "text-emerald-600")}>
            {item.type === "income" ? "+" : ""}
            {formatMoneyFromDecimal(item.amount)}
          </p>
          <p className="truncate text-sm text-foreground/90" title={label}>
            {label}
          </p>
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            aria-expanded={picking}
            aria-label={t("capture.inbox.changeCategory")}
            className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
          >
            <span className="text-muted-foreground">{t("capture.inbox.aiSuggest")} →</span>
            <span aria-hidden="true">{categoryEmoji(category?.icon ?? null)}</span>
            <span className="truncate font-medium">
              {category ? (locale === "th" ? category.name_th : category.name_en) : t("capture.category")}
              {unsure ? " ?" : ""}
            </span>
            <ChevronDown className="size-3 shrink-0" aria-hidden="true" />
          </button>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {inboxReviewReasons(item, categories).map((reason) => (
              <span
                key={reason}
                className="rounded-md border border-dashed border-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300"
              >
                {t(`capture.inbox.reason.${reason}`)}
              </span>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {formatFriendlyDate(item.transaction_date, locale, { today: t("capture.today"), yesterday: t("capture.yesterday") })}
            {item.account_name ? ` · ${item.account_name}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <Button
            type="button"
            size="icon"
            className="size-11 rounded-full"
            aria-label={t("capture.inbox.confirm")}
            disabled={pending}
            onClick={() => confirm()}
          >
            <Check className="size-5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-11 rounded-full"
            aria-label={t("capture.edit")}
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
      {picking ? (
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

/** Above this many pending items the box folds to COLLAPSED_COUNT cards plus "show N more". */
const COLLAPSE_ABOVE = 5;
const COLLAPSED_COUNT = 3;

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
}: {
  inbox: DailyInbox;
  categories: Category[];
  accounts: Account[];
}) {
  const { t } = useTranslation();
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
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
  const pending = visible.filter((i) => i.review_status === "needs_review" && !confirmedIds.has(i.id));
  // Only complete items may be bulk-confirmed; undecided categories need a pick.
  const bulkConfirmable = pending.filter((i) => canBulkConfirm(i, categories));
  const needsPick = pending.length - bulkConfirmable.length;
  const folded = !expanded && pending.length > COLLAPSE_ABOVE;
  const shown = folded ? pending.slice(0, COLLAPSED_COUNT) : pending;

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

  if (pending.length === 0) return null;

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

      <ul className="space-y-2">
        {shown.map((item) => (
          <InboxItem key={item.id} item={item} categories={categories} accounts={accounts} onConfirmed={markConfirmed} onDelete={deleteItem} />
        ))}
      </ul>

      {folded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center justify-center gap-1 rounded-xl py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-500/10 dark:text-amber-300"
        >
          <ChevronDown className="size-3.5" aria-hidden="true" />
          {t("capture.inbox.showMore").replace("{count}", String(pending.length - COLLAPSED_COUNT))}
        </button>
      ) : null}
    </section>
  );
}
