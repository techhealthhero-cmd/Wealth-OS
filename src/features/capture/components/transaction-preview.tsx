"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Pencil } from "lucide-react";

import type { Account, Category } from "@/types/database";
import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatMoney, formatMoneyFromDecimal, parseMoneyToCents } from "@/lib/financial/money";
import { ACCOUNT_TYPE_EMOJI, categoryEmoji, formatFriendlyDate } from "@/lib/transaction-ui";
import { canSaveDraft, type CaptureDraft } from "@/lib/capture/draft";
import { CategoryPicker } from "@/features/transactions/components/category-picker";
import { AccountPicker } from "@/features/transactions/components/account-picker";
import type { PossibleDuplicate } from "@/features/capture/actions";
import { ConfidenceBadge } from "./confidence-badge";

type OpenPanel = "category" | "account" | null;

interface TransactionPreviewProps {
  draft: CaptureDraft;
  accounts: Account[];
  categories: Category[];
  heading: string;
  onChange: (patch: Partial<CaptureDraft>) => void;
  onSave: () => void;
  onEdit: () => void;
  saving: boolean;
  saveLabel: string;
  duplicate?: PossibleDuplicate | null;
  onSaveAnyway?: () => void;
  notice?: React.ReactNode;
}

function amountToInput(cents: number | null) {
  return cents === null ? "" : (cents / 100).toString();
}

/**
 * The confirmation card. The amount dominates; category and account are
 * one-tap chips that open the existing pickers inline (progressive
 * disclosure, no extra modal layer); "แก้ไข" hands off to the full manual
 * form with everything prefilled. Nothing here ever blocks except a
 * missing amount or account.
 */
export function TransactionPreview({
  draft,
  accounts,
  categories,
  heading,
  onChange,
  onSave,
  onEdit,
  saving,
  saveLabel,
  duplicate,
  onSaveAnyway,
  notice,
}: TransactionPreviewProps) {
  const { t, locale } = useTranslation();
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [showExisting, setShowExisting] = useState(false);
  const [amountText, setAmountText] = useState(() => amountToInput(draft.amountCents));
  const [lastAmount, setLastAmount] = useState(draft.amountCents);

  // Re-sync the editable text when the amount changes from outside (the
  // user keeps typing the sentence above) — "adjust state during render"
  // pattern, no effect needed.
  if (draft.amountCents !== lastAmount) {
    setLastAmount(draft.amountCents);
    setAmountText(amountToInput(draft.amountCents));
  }

  const relevantCategories = useMemo(
    () => categories.filter((c) => c.type === draft.type || c.type === "both"),
    [categories, draft.type]
  );
  const category = categories.find((c) => c.id === draft.categoryId) ?? null;
  const account = accounts.find((a) => a.id === draft.accountId) ?? null;
  const categoryLabel = category ? (locale === "th" ? category.name_th : category.name_en) : t("capture.category");
  const label = draft.merchant && draft.description && draft.description !== draft.merchant
    ? `${draft.merchant} · ${draft.description}`
    : draft.merchant ?? draft.description;
  const amountMissing = draft.amountCents === null;
  const guessed = draft.categorySource === "fallback" && !draft.categoryConfirmedByUser;

  function commitAmount(text: string) {
    setAmountText(text);
    const cleaned = text.replace(/,/g, "").trim();
    let cents: number | null = null;
    if (/^\d+(\.\d{0,2})?$/.test(cleaned)) {
      // "12." is a valid in-progress entry — parse the digits typed so far.
      const value = cleaned.endsWith(".") ? cleaned.slice(0, -1) : cleaned;
      try {
        const parsed = parseMoneyToCents(value);
        cents = parsed > 0 ? parsed : null;
      } catch {
        cents = null;
      }
    }
    // Record it as "ours" first so the render-time re-sync above never
    // overwrites what the user is typing.
    setLastAmount(cents);
    onChange({ amountCents: cents });
  }

  const chip =
    "inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-sm font-medium transition-colors active:scale-[0.98] hover:bg-muted";

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-card animate-in fade-in slide-in-from-bottom-1 duration-(--motion-normal)">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{heading}</p>
        <ConfidenceBadge confidence={draft.confidence} />
      </div>

      {notice}

      {/* Amount — visually dominant; directly editable. */}
      <div>
        <label className="sr-only" htmlFor="capture-amount">
          {t("capture.amount")}
        </label>
        <div className="flex items-baseline gap-1">
          <span className={cn("text-3xl font-bold", draft.type === "income" ? "text-emerald-600" : "text-foreground")}>฿</span>
          <input
            id="capture-amount"
            inputMode="decimal"
            autoComplete="off"
            value={amountText}
            onChange={(e) => commitAmount(e.target.value)}
            placeholder="0"
            aria-invalid={amountMissing}
            className={cn(
              "w-full min-w-0 bg-transparent text-4xl font-bold tracking-tight tabular-nums outline-none placeholder:text-muted-foreground/40",
              draft.type === "income" && "text-emerald-600"
            )}
          />
        </div>
        {amountMissing ? <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{t("capture.amountMissing")}</p> : null}
      </div>

      {label ? <p className="truncate text-sm text-foreground/90" title={label}>{label}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cn(chip, openPanel === "category" && "border-primary ring-1 ring-primary")}
          aria-expanded={openPanel === "category"}
          onClick={() => setOpenPanel(openPanel === "category" ? null : "category")}
        >
          <span aria-hidden="true">{categoryEmoji(category?.icon ?? null)}</span>
          <span className="truncate">{categoryLabel}</span>
          {guessed ? <span className="text-amber-600" aria-hidden="true">?</span> : null}
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={cn(chip, openPanel === "account" && "border-primary ring-1 ring-primary")}
          aria-expanded={openPanel === "account"}
          onClick={() => setOpenPanel(openPanel === "account" ? null : "account")}
        >
          <span aria-hidden="true">{account ? ACCOUNT_TYPE_EMOJI[account.account_type] : "💳"}</span>
          <span className="truncate">{account?.name ?? t("capture.account")}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
        <span className={cn(chip, "cursor-default hover:bg-background")}>
          <span aria-hidden="true">📅</span>
          {formatFriendlyDate(draft.date, locale, { today: t("capture.today"), yesterday: t("capture.yesterday") })}
        </span>
      </div>

      {guessed && openPanel !== "category" ? <p className="text-xs text-muted-foreground">{t("capture.categoryGuessed")}</p> : null}

      {openPanel === "category" ? (
        <CategoryPicker
          name="__capture_category"
          categories={relevantCategories}
          value={draft.categoryId}
          onValueChange={(id) => {
            onChange({ categoryId: id, categoryConfirmedByUser: true, categorySource: id ? "learned" : null });
            if (id) setOpenPanel(null);
          }}
        />
      ) : null}
      {openPanel === "account" ? (
        <AccountPicker
          name="__capture_account"
          accounts={accounts.filter((a) => !a.is_archived)}
          value={draft.accountId ?? undefined}
          onValueChange={(id) => {
            onChange({ accountId: id ?? null });
            setOpenPanel(null);
          }}
        />
      ) : null}

      {accounts.length === 0 ? <p className="text-xs text-destructive">{t("capture.noAccount")}</p> : null}

      {duplicate ? (
        <div role="alert" className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
            <AlertTriangle className="size-4" aria-hidden="true" />
            {t("capture.duplicateTitle")}
          </p>
          {showExisting ? (
            <p className="text-xs text-foreground/80">
              {formatMoneyFromDecimal(duplicate.amount)} · {duplicate.description || duplicate.merchant || "—"} ·{" "}
              {formatFriendlyDate(duplicate.transaction_date, locale, { today: t("capture.today"), yesterday: t("capture.yesterday") })}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowExisting((v) => !v)}>
              {showExisting ? t("capture.hideExisting") : t("capture.viewExisting")}
            </Button>
            <Button type="button" size="sm" onClick={onSaveAnyway} disabled={saving}>
              {t("capture.saveAnyway")}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="h-11 flex-1 rounded-xl" onClick={onEdit}>
          <Pencil className="mr-1.5 size-4" aria-hidden="true" />
          {t("capture.edit")}
        </Button>
        <Button
          type="button"
          className="h-11 flex-[2] rounded-xl text-base"
          onClick={onSave}
          disabled={saving || !canSaveDraft(draft) || Boolean(duplicate)}
        >
          <Check className="mr-1.5 size-5" aria-hidden="true" />
          {saveLabel}
          {draft.amountCents ? <span className="ml-1 opacity-80">{formatMoney(draft.amountCents, "THB", undefined, draft.amountCents % 100 ? 2 : 0)}</span> : null}
        </Button>
      </div>
    </div>
  );
}
