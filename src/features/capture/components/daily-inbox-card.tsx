"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, Inbox, Pencil } from "lucide-react";

import type { Account, Category, Transaction } from "@/types/database";
import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoneyFromDecimal } from "@/lib/financial/money";
import { categoryEmoji, formatFriendlyDate } from "@/lib/transaction-ui";
import { CategoryPicker } from "@/features/transactions/components/category-picker";
import { TransactionForm } from "@/features/transactions/components/transaction-form";
import { confirmInboxTransaction } from "@/features/capture/actions";
import { deleteTransaction } from "@/features/transactions/actions";
import { SwipeToDelete } from "@/components/shared/swipe-to-delete";
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
    >
    <div className={cn("space-y-2 rounded-2xl border bg-background p-3 transition-opacity", pending && "opacity-50")}>
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

/** How long a swiped-away item can still be brought back. */
const UNDO_WINDOW_MS = 5000;

/**
 * Daily Inbox — "capture first, organize later". Everything captured today
 * plus anything still marked needs_review, with one-tap ✓, one-tap
 * category fix (which also confirms), or the full edit form.
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
  const [showConfirmed, setShowConfirmed] = useState(false);
  const [confirmingAll, startConfirmAll] = useTransition();
  // Swiped-away items: hidden at once, actually deleted only once the undo
  // toast is gone — a mis-swipe costs nothing. Leaving the page commits any
  // that are still waiting.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const pendingDeletes = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  async function commitDelete(id: string) {
    if (!pendingDeletes.current.has(id)) return; // undone, or already sent
    pendingDeletes.current.delete(id);
    const res = await deleteTransaction(id);
    if (!res.success) {
      setHiddenIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.error(res.error ?? t("capture.saveFailed"));
    }
  }

  function deleteItem(item: InboxTransaction) {
    // Our own timer decides when the delete happens — not the toast's
    // lifecycle, which pauses while the screen is being touched.
    pendingDeletes.current.set(
      item.id,
      setTimeout(() => void commitDelete(item.id), UNDO_WINDOW_MS)
    );
    setHiddenIds((prev) => new Set(prev).add(item.id));
    toast(t("capture.inbox.deleted"), {
      description: `${item.description || item.merchant || t("capture.inbox.unknownMerchant")} · ${formatMoneyFromDecimal(item.amount)}`,
      duration: UNDO_WINDOW_MS,
      action: {
        label: t("capture.undo"),
        onClick: () => {
          const timer = pendingDeletes.current.get(item.id);
          if (timer === undefined) return; // already deleted
          clearTimeout(timer);
          pendingDeletes.current.delete(item.id);
          setHiddenIds((prev) => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
        },
      },
    });
  }

  // Leaving the page never loses a delete the user asked for.
  useEffect(() => {
    const waiting = pendingDeletes.current;
    return () => {
      for (const [id, timer] of waiting) {
        clearTimeout(timer);
        void deleteTransaction(id);
      }
      waiting.clear();
    };
  }, []);

  const visible = inbox.items.filter((i) => !hiddenIds.has(i.id));
  const pending = visible.filter((i) => i.review_status === "needs_review" && !confirmedIds.has(i.id));
  // Only complete items may be bulk-confirmed; undecided categories need a pick.
  const bulkConfirmable = pending.filter((i) => canBulkConfirm(i, categories));
  const needsPick = pending.length - bulkConfirmable.length;
  const confirmedToday = visible.filter(
    (i) => i.transaction_date === inbox.today && (i.review_status === "confirmed" || confirmedIds.has(i.id))
  );

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

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Inbox className="size-4.5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-heading text-base font-semibold leading-tight">{t("capture.inbox.title")}</p>
              <p className="text-xs text-muted-foreground">
                {t("capture.inbox.todayCount").replace("{count}", String(inbox.todayCount))}
              </p>
            </div>
          </div>
          {pending.length >= 2 && bulkConfirmable.length > 0 ? (
            <Button type="button" size="sm" variant="outline" onClick={confirmAll} disabled={confirmingAll}>
              <Check className="mr-1 size-3.5" aria-hidden="true" />
              {bulkConfirmable.length === pending.length
                ? t("capture.inbox.confirmAll")
                : t("capture.inbox.confirmReady").replace("{count}", String(bulkConfirmable.length))}
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-700 dark:text-emerald-400">
            ✓ {t("capture.inbox.confirmed").replace("{count}", String(confirmedToday.length))}
          </span>
          {pending.length > 0 ? (
            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 font-medium text-amber-700 dark:text-amber-400">
              ⚠️ {t("capture.inbox.pending").replace("{count}", String(pending.length))}
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground">
              {t("capture.inbox.allDone")}
            </span>
          )}
        </div>

        {needsPick > 0 && pending.length >= 2 ? (
          <p className="text-xs text-muted-foreground">{t("capture.inbox.needsPickHint").replace("{count}", String(needsPick))}</p>
        ) : null}

        {pending.length > 0 ? <p className="text-[11px] text-muted-foreground">{t("capture.inbox.swipeHint")}</p> : null}

        {pending.length > 0 ? (
          <ul className="space-y-2">
            {pending.map((item) => (
              <InboxItem key={item.id} item={item} categories={categories} accounts={accounts} onConfirmed={markConfirmed} onDelete={deleteItem} />
            ))}
          </ul>
        ) : null}

        {confirmedToday.length > 0 ? (
          <div>
            <button
              type="button"
              onClick={() => setShowConfirmed((v) => !v)}
              aria-expanded={showConfirmed}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className={cn("size-3.5 transition-transform", showConfirmed && "rotate-180")} aria-hidden="true" />
              {t("capture.inbox.confirmed").replace("{count}", String(confirmedToday.length))}
            </button>
            {showConfirmed ? (
              <ul className="mt-2 divide-y text-sm">
                {confirmedToday.map((item) => {
                  const category = categories.find((c) => c.id === item.category_id);
                  return (
                    <SwipeToDelete
                      key={item.id}
                      as="li"
                      deleteLabel={t("capture.inbox.delete")}
                      a11yLabel={`${t("capture.inbox.delete")}: ${item.description || item.merchant || "—"} ${formatMoneyFromDecimal(item.amount)}`}
                      onDelete={() => deleteItem(item)}
                    >
                    <div className="flex items-center justify-between gap-2 bg-card py-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span aria-hidden="true">{categoryEmoji(category?.icon ?? null)}</span>
                        <span className="truncate">{item.description || item.merchant || "—"}</span>
                      </span>
                      <span className={cn("shrink-0 tabular-nums", item.type === "income" && "text-emerald-600")}>
                        {formatMoneyFromDecimal(item.amount)}
                      </span>
                    </div>
                    </SwipeToDelete>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
