"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, Check, ImagePlus, Loader2, PencilLine, ReceiptText, Smartphone } from "lucide-react";

import type { Account, Category } from "@/types/database";
import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryIcon } from "@/components/shared/category-icon";
import { SwipeToDelete } from "@/components/shared/swipe-to-delete";
import { CategoryPicker } from "@/features/transactions/components/category-picker";
import { formatMoneyFromDecimal, parseMoneyToCents } from "@/lib/financial/money";
import { formatFriendlyDate } from "@/lib/transaction-ui";
import { isUndecidedCategory } from "@/lib/capture/inbox";
import { confirmSlip, dismissSlip, restoreSlip } from "@/features/slip-inbox/actions";
import type { PendingSlip } from "@/features/slip-inbox/queries";
import { useSlipBatchUpload } from "./use-slip-batch-upload";

function centsFromInput(value: string): number | null {
  const clean = value.replace(/[,\s฿]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  try {
    const cents = parseMoneyToCents(clean);
    return cents > 0 ? cents : null;
  } catch {
    return null;
  }
}

function SlipItem({
  slip,
  accounts,
  categories,
  today,
  onDone,
  onDismiss,
}: {
  slip: PendingSlip;
  accounts: Account[];
  categories: Category[];
  today: string;
  onDone: (id: string) => void;
  onDismiss: (slip: PendingSlip) => void;
}) {
  const { t, locale } = useTranslation();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [categoryId, setCategoryId] = useState(slip.category_id);
  const [categoryPicked, setCategoryPicked] = useState(false);
  const activeAccounts = useMemo(() => accounts.filter((a) => !a.is_archived), [accounts]);
  const [accountId, setAccountId] = useState(slip.account_id ?? activeAccounts[0]?.id ?? "");
  const [amountText, setAmountText] = useState(slip.amount ? String(Number(slip.amount)) : "");
  const [date, setDate] = useState(slip.slip_date ?? today);
  const [merchant, setMerchant] = useState(slip.merchant ?? "");

  const expenseCategories = useMemo(() => categories.filter((c) => c.type === "expense" || c.type === "both"), [categories]);
  const category = categories.find((c) => c.id === categoryId) ?? null;
  const decided = Boolean(categoryId) && (categoryPicked || !isUndecidedCategory(categoryId, categories));
  const amountCents = centsFromInput(amountText);
  const account = accounts.find((a) => a.id === accountId) ?? null;
  const canConfirm = decided && amountCents !== null && Boolean(account) && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const label = merchant.trim() || t("slipInbox.unknownMerchant");
  const friendlyDate = formatFriendlyDate(date, locale, { today: t("capture.today"), yesterday: t("capture.yesterday") });

  function confirm() {
    if (!canConfirm || amountCents === null) {
      if (!decided) setPicking(true);
      else setEditing(true);
      return;
    }
    startTransition(async () => {
      const res = await confirmSlip({
        slipId: slip.id,
        amountCents,
        accountId,
        categoryId,
        merchant: merchant.trim() || null,
        date,
      });
      if (res.success) {
        onDone(slip.id);
        toast.success(t("slipInbox.confirmed").replace("{account}", account?.name ?? ""));
      } else toast.error(res.error ?? t("slipInbox.saveFailed"));
    });
  }

  return (
    <SwipeToDelete
      as="li"
      deleteLabel={t("slipInbox.dismiss")}
      a11yLabel={`${t("slipInbox.dismiss")}: ${label}`}
      onDelete={() => onDismiss(slip)}
      editLabel={t("slipInbox.edit")}
      onEdit={() => setEditing(true)}
    >
      <div className={cn("bg-card px-3 transition-opacity", pending && "opacity-50")}>
        <div className="flex items-center gap-2 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tabular-nums">
              {amountCents !== null ? formatMoneyFromDecimal((amountCents / 100).toFixed(2)) : "—"}
            </p>
            <p className="truncate text-xs text-muted-foreground" title={label}>
              {label} · {slip.slip_date ? friendlyDate : t("slipInbox.noDate")}
              {slip.slip_date && slip.slip_time ? ` ${slip.slip_time}` : ""}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {t("slipInbox.account")}: {account?.name ?? "—"}
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
                <CategoryIcon icon={category.icon} className="-my-1 size-6" />
                <span className="truncate">{locale === "th" ? category.name_th : category.name_en}</span>
              </>
            ) : (
              <span>? {t("capture.category")}</span>
            )}
          </button>
          <Button
            type="button"
            size="icon"
            className="size-9 shrink-0 rounded-full"
            aria-label={t("slipInbox.confirm")}
            disabled={pending}
            onClick={confirm}
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
          </Button>
        </div>

        {slip.possible_duplicate_of || slip.confidence !== "high" ? (
          <div className="flex flex-wrap gap-1.5 pb-2">
            {slip.possible_duplicate_of ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300"
                title={t("slipInbox.possibleDuplicateHint")}
              >
                <AlertTriangle className="size-3" aria-hidden="true" />
                {t("slipInbox.possibleDuplicate")}
              </span>
            ) : null}
            {slip.confidence !== "high" ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{t("slipInbox.unsure")}</span>
            ) : null}
          </div>
        ) : null}

        {picking ? (
          <div className="pb-3">
            <CategoryPicker
              name={`__slip_category_${slip.id}`}
              categories={expenseCategories}
              value={categoryId}
              onValueChange={(id) => {
                setPicking(false);
                if (id) {
                  setCategoryId(id);
                  setCategoryPicked(true);
                }
              }}
            />
          </div>
        ) : null}

        {editing ? (
          <div className="grid grid-cols-2 gap-2 pb-3">
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">{t("slipInbox.amount")}</span>
              <Input inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} aria-invalid={amountCents === null} />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">{t("slipInbox.date")}</span>
              <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="col-span-2 space-y-1 text-xs">
              <span className="text-muted-foreground">{t("slipInbox.merchant")}</span>
              <Input value={merchant} maxLength={120} onChange={(e) => setMerchant(e.target.value)} />
            </label>
            <label className="col-span-2 space-y-1 text-xs">
              <span className="text-muted-foreground">{t("slipInbox.account")}</span>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" variant="outline" size="sm" className="col-span-2" onClick={() => setEditing(false)}>
              {t("slipInbox.done")}
            </Button>
          </div>
        ) : null}
      </div>
    </SwipeToDelete>
  );
}

/**
 * Slips sent by the iPhone Shortcut or a bulk upload, waiting for the user
 * (migration 0046). Unlike the Daily Inbox below it, nothing here is a
 * transaction yet: no balance has moved. ✓ saves one through the normal
 * capture path; swipe left = "not this one".
 */
export function SlipInboxCard({
  slips,
  accounts,
  categories,
  today,
}: {
  slips: PendingSlip[];
  accounts: Account[];
  categories: Category[];
  today: string;
}) {
  const { t } = useTranslation();
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const batch = useSlipBatchUpload();
  const visible = slips.filter((s) => !doneIds.has(s.id));

  function hide(id: string, hidden: boolean) {
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (hidden) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function dismiss(slip: PendingSlip) {
    hide(slip.id, true);
    const res = await dismissSlip(slip.id);
    if (!res.success) {
      hide(slip.id, false);
      toast.error(res.error ?? t("slipInbox.saveFailed"));
      return;
    }
    toast(t("slipInbox.dismissed"), {
      description: slip.merchant ?? undefined,
      action: {
        label: t("slipInbox.undo"),
        onClick: async () => {
          const restored = await restoreSlip(slip.id);
          if (restored.success) hide(slip.id, false);
        },
      },
    });
  }

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="outline" disabled={batch.busy} onClick={() => inputRef.current?.click()}>
        {batch.busy ? (
          <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <ImagePlus className="mr-1 size-3.5" aria-hidden="true" />
        )}
        {batch.progress
          ? t("slipInbox.upload.progress").replace("{done}", String(batch.progress.done)).replace("{total}", String(batch.progress.total))
          : t("slipInbox.addMany")}
      </Button>
      <Button type="button" size="sm" variant="ghost" nativeButton={false} render={<Link href="/profile/slip-shortcut" />}>
        <Smartphone className="mr-1 size-3.5" aria-hidden="true" />
        {t("slipInbox.setupShortcut")}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          e.target.value = "";
          void batch.upload(files);
        }}
      />
    </div>
  );

  if (visible.length === 0) {
    return <div className="rounded-2xl border border-dashed p-3">{actions}</div>;
  }

  return (
    <section aria-labelledby="slip-inbox-title" className="space-y-3 rounded-2xl border border-dashed border-sky-400/70 bg-sky-500/10 p-3">
      <div className="space-y-0.5">
        <h2 id="slip-inbox-title" className="flex items-center gap-1.5 font-heading text-sm font-semibold text-sky-900 dark:text-sky-200">
          <ReceiptText className="size-4" aria-hidden="true" />
          {t("slipInbox.title").replace("{count}", String(visible.length))}
        </h2>
        <p className="text-[11px] text-muted-foreground">
          {t("slipInbox.subtitle")} · {t("capture.inbox.swipeHint")}
        </p>
      </div>
      <ul className="divide-y overflow-hidden rounded-xl border">
        {visible.map((slip) => (
          <SlipItem
            key={slip.id}
            slip={slip}
            accounts={accounts}
            categories={categories}
            today={today}
            onDone={(id) => hide(id, true)}
            onDismiss={(s) => void dismiss(s)}
          />
        ))}
      </ul>
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <PencilLine className="size-3" aria-hidden="true" />
        {t("slipInbox.addManyHint")}
      </p>
      {actions}
    </section>
  );
}
