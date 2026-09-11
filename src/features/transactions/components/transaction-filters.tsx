"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import type { Account, Category, TransactionType } from "@/types/database";
import { useTranslation } from "@/i18n/client";
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
}

export function TransactionFilters({ accounts, categories }: TransactionFiltersProps) {
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

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <Input
        placeholder={t("transactions.searchPlaceholder")}
        defaultValue={searchParams.get("q") ?? ""}
        onChange={(e) => setParam("q", e.target.value)}
        aria-label={t("transactions.searchTransactions")}
      />

      <Select
        defaultValue={searchParams.get("type") ?? ALL}
        onValueChange={(v) => setParam("type", v)}
      >
        <SelectTrigger aria-label={t("transactions.filterByType")}>
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
        <SelectTrigger aria-label={t("transactions.filterByAccount")}>
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
        <SelectTrigger aria-label={t("transactions.filterByCategory")}>
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
    </div>
  );
}
