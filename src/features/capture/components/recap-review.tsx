"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Loader2, Sparkles, Trash2 } from "lucide-react";

import type { Account, Category } from "@/types/database";
import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatMoney, parseMoneyToCents } from "@/lib/financial/money";
import { categoryEmoji, formatFriendlyDate } from "@/lib/transaction-ui";
import { canSaveDraft, type CaptureDraft } from "@/lib/capture/draft";
import { recapTotals } from "@/lib/capture/recap";
import { CategoryPicker } from "@/features/transactions/components/category-picker";
import { AccountPicker } from "@/features/transactions/components/account-picker";

export interface RecapRow {
  id: string;
  sourceText: string;
  draft: CaptureDraft;
}

function amountText(cents: number | null) {
  return cents === null ? "" : (cents / 100).toString();
}

function parseAmount(text: string): number | null {
  const cleaned = text.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  try {
    const cents = parseMoneyToCents(cleaned.endsWith(".") ? cleaned.slice(0, -1) : cleaned);
    return cents > 0 ? cents : null;
  } catch {
    return null;
  }
}

/**
 * The day's items, read from one recap: a running total up top, one tidy
 * row per item (tap to fix anything), and one button that saves them all.
 * Nothing is saved until the user confirms.
 */
export function RecapReview({
  rows,
  accounts,
  categories,
  onChange,
  onRemove,
  onConfirm,
  saving,
  progress,
  aiPending,
}: {
  rows: RecapRow[];
  accounts: Account[];
  categories: Category[];
  onChange: (id: string, patch: Partial<CaptureDraft>) => void;
  onRemove: (id: string) => void;
  onConfirm: () => void;
  saving: boolean;
  progress: { done: number; total: number } | null;
  aiPending: boolean;
}) {
  const { t, locale } = useTranslation();
  const [openId, setOpenId] = useState<string | null>(null);
  const totals = useMemo(() => recapTotals(rows.map((r) => r.draft)), [rows]);
  const saveable = rows.filter((r) => canSaveDraft(r.draft));
  const unsaveable = rows.length - saveable.length;

  return (
    <section
      aria-labelledby="recap-heading"
      className="space-y-3 rounded-2xl border bg-card p-4 shadow-card animate-in fade-in slide-in-from-bottom-1 duration-(--motion-normal)"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="recap-heading" className="font-semibold">
          {t("capture.recap.found").replace("{n}", String(rows.length))}
        </h3>
        <div className="flex gap-1.5 text-xs font-semibold tabular-nums">
          {totals.expenseCount ? (
            <span className="rounded-full bg-muted px-2.5 py-1">
              {t("capture.recap.spent")} {formatMoney(totals.expenseCents)}
            </span>
          ) : null}
          {totals.incomeCount ? (
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-700 dark:text-emerald-400">
              {t("capture.recap.received")} {formatMoney(totals.incomeCents)}
            </span>
          ) : null}
        </div>
      </div>

      {aiPending ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
          <Sparkles className="size-3.5" aria-hidden="true" />
          {t("capture.recap.aiSorting")}
        </p>
      ) : null}

      <ul className="divide-y rounded-xl border">
        {rows.map((row) => {
          const d = row.draft;
          const category = categories.find((c) => c.id === d.categoryId) ?? null;
          const guessed = d.categorySource === "fallback" && !d.categoryConfirmedByUser;
          const open = openId === row.id;
          const label = d.merchant ?? d.description ?? row.sourceText;
          const income = d.type === "income";
          return (
            <li key={row.id}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : row.id)}
                className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-base" aria-hidden="true">
                  {categoryEmoji(category?.icon ?? null)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{label}</span>
                  <span className={cn("block truncate text-xs", guessed ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                    {guessed ? t("capture.recap.pickCategory") : category ? (locale === "th" ? category.name_th : category.name_en) : "—"}
                  </span>
                </span>
                <span className={cn("shrink-0 text-sm font-semibold tabular-nums", income && "text-emerald-600 dark:text-emerald-400")}>
                  {d.amountCents === null ? (
                    <span className="text-amber-700 dark:text-amber-400">{t("capture.recap.noAmount")}</span>
                  ) : (
                    `${income ? "+" : "−"}${formatMoney(d.amountCents, "THB", undefined, d.amountCents % 100 ? 2 : 0)}`
                  )}
                </span>
                <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden="true" />
              </button>

              {open ? (
                <RecapRowEditor
                  row={row}
                  accounts={accounts}
                  categories={categories}
                  onChange={(patch) => onChange(row.id, patch)}
                  onRemove={() => {
                    setOpenId(null);
                    onRemove(row.id);
                  }}
                  onDone={() => setOpenId(null)}
                  dateLabel={formatFriendlyDate(d.date, locale, { today: t("capture.today"), yesterday: t("capture.yesterday") })}
                />
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-muted-foreground">{t("capture.recap.learnHint")}</p>
      {unsaveable > 0 ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">{t("capture.recap.someMissing").replace("{n}", String(unsaveable))}</p>
      ) : null}

      <Button type="button" className="h-12 w-full rounded-2xl text-base" onClick={onConfirm} disabled={saving || saveable.length === 0}>
        {saving ? (
          <>
            <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" />
            {progress ? t("capture.recap.saving").replace("{done}", String(progress.done)).replace("{n}", String(progress.total)) : t("common.saving")}
          </>
        ) : (
          <>
            <Check className="mr-1.5 size-5" aria-hidden="true" />
            {t("capture.recap.confirmAll").replace("{n}", String(saveable.length))}
          </>
        )}
      </Button>
    </section>
  );
}

function RecapRowEditor({
  row,
  accounts,
  categories,
  onChange,
  onRemove,
  onDone,
  dateLabel,
}: {
  row: RecapRow;
  accounts: Account[];
  categories: Category[];
  onChange: (patch: Partial<CaptureDraft>) => void;
  onRemove: () => void;
  onDone: () => void;
  dateLabel: string;
}) {
  const { t } = useTranslation();
  const d = row.draft;
  const [text, setText] = useState(() => amountText(d.amountCents));
  const relevant = useMemo(() => categories.filter((c) => c.type === d.type || c.type === "both"), [categories, d.type]);
  const inputId = `recap-amount-${row.id}`;

  return (
    <div className="space-y-3 border-t bg-muted/30 px-3 py-3">
      <p className="text-xs text-muted-foreground">“{row.sourceText}”</p>

      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <div className="space-y-1">
          <label htmlFor={inputId} className="text-xs font-medium">
            {t("capture.amount")}
          </label>
          <input
            id={inputId}
            inputMode="decimal"
            autoComplete="off"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onChange({ amountCents: parseAmount(e.target.value) });
            }}
            className="h-11 w-full rounded-xl border bg-background px-3 text-base tabular-nums outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </div>
        <div role="radiogroup" aria-label={t("capture.recap.typeLabel")} className="flex h-11 rounded-xl border bg-background p-1">
          {(["expense", "income"] as const).map((type) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={d.type === type}
              onClick={() => {
                if (d.type === type) return;
                // A different type needs a category of that type — the user picks it.
                onChange({ type, categoryId: null, categorySource: null, categoryConfirmedByUser: false });
              }}
              className={cn(
                "rounded-lg px-3 text-sm font-medium",
                d.type === type ? (type === "income" ? "bg-emerald-600 text-white" : "bg-foreground text-background") : "text-muted-foreground"
              )}
            >
              {type === "income" ? t("capture.recap.income") : t("capture.recap.expense")}
            </button>
          ))}
        </div>
      </div>

      <CategoryPicker
        name={`__recap_category_${row.id}`}
        categories={relevant}
        value={d.categoryId}
        onValueChange={(id) => onChange({ categoryId: id, categoryConfirmedByUser: Boolean(id), categorySource: id ? "learned" : null })}
      />

      <div className="grid grid-cols-[1fr_auto] items-center gap-2">
        <AccountPicker
          name={`__recap_account_${row.id}`}
          accounts={accounts.filter((a) => !a.is_archived)}
          value={d.accountId ?? undefined}
          onValueChange={(id) => onChange({ accountId: id ?? null })}
        />
        <span className="flex h-9 items-center gap-1 rounded-full border bg-background px-3 text-xs">
          <span aria-hidden="true">📅</span>
          {dateLabel}
        </span>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="ghost" className="h-10 text-destructive hover:text-destructive" onClick={onRemove}>
          <Trash2 className="mr-1.5 size-4" aria-hidden="true" />
          {t("capture.recap.remove")}
        </Button>
        <Button type="button" variant="outline" className="ml-auto h-10 rounded-xl" onClick={onDone}>
          {t("capture.recap.done")}
        </Button>
      </div>
    </div>
  );
}
