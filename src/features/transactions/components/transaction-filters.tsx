"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { MessageSquareText, MoreHorizontal, Search } from "lucide-react";

import type { Account, Category, TransactionType } from "@/types/database";
import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TYPE_OPTIONS: TransactionType[] = [
  "income",
  "expense",
  "transfer",
  "refund",
  "debt_payment",
  "savings_transfer",
  "investment_allocation",
];

const ALL = "__all__";

interface TransactionFiltersProps {
  accounts: Account[];
  categories: Category[];
  /** Rarely used actions (exports), tucked behind the row's "⋯" pill. */
  moreActions?: ReactNode;
}

const PILL = "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors";

export function TransactionFilters({ accounts, categories, moreActions }: TransactionFiltersProps) {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== ALL) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    startTransition(() => {
      router.push(`/money/transactions?${params.toString()}`);
    });
  }

  const categoryName = (category: Category) => (locale === "th" ? category.name_th : category.name_en);

  const typeLabel = (value: string | null) => {
    const match = TYPE_OPTIONS.find((o) => o === value);
    return match ? t(`transactions.types.${match}`) : t("transactions.allTypes");
  };
  const accountLabel = (value: string | null) =>
    accounts.find((a) => a.id === value)?.name ?? t("transactions.allAccounts");
  const categoryLabel = (value: string | null) => {
    const match = categories.find((c) => c.id === value);
    return match ? categoryName(match) : t("transactions.allCategories");
  };

  const hasNotesActive = searchParams.get("notes") === "1";
  // The search box opens from the 🔍 pill; it starts open when a search is active.
  const [searchOpen, setSearchOpen] = useState(Boolean(searchParams.get("q")));
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="space-y-2">
      {/* One horizontally scrollable row: 🔍 · type · account · category ·
          notes · ⋯ — so the list starts high on a phone (2026-10-11). */}
      <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        onClick={() => setSearchOpen((v) => !v)}
        aria-expanded={searchOpen}
        aria-label={t("transactions.searchTransactions")}
        className={cn(PILL, searchOpen ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted")}
      >
        <Search className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      <Select
        defaultValue={searchParams.get("type") ?? ALL}
        onValueChange={(v) => setParam("type", v)}
      >
        <SelectTrigger className="h-8 max-w-56 shrink-0 rounded-full bg-card text-xs" aria-label={t("transactions.filterByType")}>
          <SelectValue placeholder={t("transactions.allTypes")}>{typeLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("transactions.allTypes")}</SelectItem>
          {TYPE_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {t(`transactions.types.${option}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        defaultValue={searchParams.get("accountId") ?? ALL}
        onValueChange={(v) => setParam("accountId", v)}
      >
        <SelectTrigger className="h-8 max-w-56 shrink-0 rounded-full bg-card text-xs" aria-label={t("transactions.filterByAccount")}>
          <SelectValue placeholder={t("transactions.allAccounts")}>{accountLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("transactions.allAccounts")}</SelectItem>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {account.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        defaultValue={searchParams.get("categoryId") ?? ALL}
        onValueChange={(v) => setParam("categoryId", v)}
      >
        <SelectTrigger className="h-8 max-w-56 shrink-0 rounded-full bg-card text-xs" aria-label={t("transactions.filterByCategory")}>
          <SelectValue placeholder={t("transactions.allCategories")}>{categoryLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("transactions.allCategories")}</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {categoryName(category)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <button
        type="button"
        onClick={() => setParam("notes", hasNotesActive ? null : "1")}
        aria-pressed={hasNotesActive}
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors",
          hasNotesActive
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-transparent text-muted-foreground hover:bg-muted"
        )}
      >
        <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
        {t("transactions.filterHasNotes")}
      </button>
      {moreActions ? (
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          aria-label={t("transactions.moreActions")}
          className={cn(PILL, moreOpen ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted")}
        >
          <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
      </div>

      {searchOpen ? (
        <Input
          autoFocus
          placeholder={t("transactions.searchPlaceholder")}
          defaultValue={searchParams.get("q") ?? ""}
          onChange={(e) => setParam("q", e.target.value)}
          aria-label={t("transactions.searchTransactions")}
        />
      ) : null}

      {moreActions && moreOpen ? <div className="flex flex-wrap items-center gap-2">{moreActions}</div> : null}
    </div>
  );
}
