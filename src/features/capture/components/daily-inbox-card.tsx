"use client";

import { useMemo, useState, useTransition } from "react";
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
import type { DailyInbox, InboxTransaction } from "@/features/capture/queries";

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
}: {
  item: InboxTransaction;
  categories: Category[];
  accounts: Account[];
  onConfirmed: (id: string) => void;
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
    <li className={cn("space-y-2 rounded-2xl border bg-background p-3 transition-opacity", pending && "opacity-50")}>
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
    </li>
  );
}

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

  const pending = inbox.items.filter((i) => i.review_status === "needs_review" && !confirmedIds.has(i.id));
  const confirmedToday = inbox.items.filter(
    (i) => i.transaction_date === inbox.today && (i.review_status === "confirmed" || confirmedIds.has(i.id))
  );

  function markConfirmed(id: string) {
    setConfirmedIds((prev) => new Set(prev).add(id));
  }

  function confirmAll() {
    startConfirmAll(async () => {
      for (const item of pending) {
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
          {pending.length >= 2 ? (
            <Button type="button" size="sm" variant="outline" onClick={confirmAll} disabled={confirmingAll}>
              <Check className="mr-1 size-3.5" aria-hidden="true" />
              {t("capture.inbox.confirmAll")}
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

        {pending.length > 0 ? (
          <ul className="space-y-2">
            {pending.map((item) => (
              <InboxItem key={item.id} item={item} categories={categories} accounts={accounts} onConfirmed={markConfirmed} />
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
                    <li key={item.id} className="flex items-center justify-between gap-2 py-1.5">
                      <span className="flex min-w-0 items-center gap-2">
                        <span aria-hidden="true">{categoryEmoji(category?.icon ?? null)}</span>
                        <span className="truncate">{item.description || item.merchant || "—"}</span>
                      </span>
                      <span className={cn("shrink-0 tabular-nums", item.type === "income" && "text-emerald-600")}>
                        {formatMoneyFromDecimal(item.amount)}
                      </span>
                    </li>
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
