"use client";

import { useState } from "react";

import type { Account, Category, TransactionType } from "@/types/database";
import type { QuickRepeatCandidate } from "@/features/transactions/queries";
import { useTranslation } from "@/i18n/client";
import { formatMoneyFromDecimal } from "@/lib/financial/money";
import { categoryEmoji, transactionTypeVisual } from "@/lib/transaction-ui";
import { TransactionForm } from "./transaction-form";

interface QuickRepeatProps {
  candidates: QuickRepeatCandidate[];
  accounts: Account[];
  categories: Category[];
}

/**
 * Recent/frequent transaction shortcuts. Tapping one only prefills a new
 * transaction form — it never submits on its own, so the user always
 * confirms (and can change) the amount, account, category, or date before
 * anything is saved. Each item remounts the form (via `key`) so its
 * uncontrolled fields always start from that item's values.
 */
export function QuickRepeat({ candidates, accounts, categories }: QuickRepeatProps) {
  const { t, locale } = useTranslation();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (candidates.length === 0 || accounts.length === 0) return null;

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const activeCandidate = activeIndex !== null ? candidates[activeIndex] : null;

  return (
    <div className="space-y-2">
      <div>
        <h2 className="text-sm font-medium">{t("transactions.quickRepeat")}</h2>
        <p className="text-xs text-muted-foreground">{t("transactions.quickRepeatHint")}</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {candidates.map((candidate, index) => {
          const category = candidate.categoryId ? categoryById.get(candidate.categoryId) : undefined;
          const label =
            candidate.merchant ||
            (category ? (locale === "th" ? category.name_th : category.name_en) : t(`transactions.types.${candidate.type}`));
          const visual = transactionTypeVisual(candidate.type as TransactionType);

          return (
            <button
              key={`${candidate.type}|${candidate.categoryId ?? ""}|${candidate.merchant ?? ""}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className="flex shrink-0 flex-col items-start gap-0.5 rounded-xl border bg-card px-3 py-2 text-left transition-colors hover:bg-accent active:scale-[0.98]"
            >
              <span className="flex items-center gap-1 text-sm font-medium">
                <span aria-hidden="true">{category ? categoryEmoji(category.icon) : visual.emoji}</span>
                <span className="max-w-[9rem] truncate">{label}</span>
              </span>
              <span className={`text-xs font-semibold ${visual.colorClass}`}>
                {formatMoneyFromDecimal(candidate.amount)}
              </span>
            </button>
          );
        })}
      </div>

      {activeCandidate ? (
        <TransactionForm
          key={activeIndex}
          defaultType={activeCandidate.type}
          accounts={accounts}
          categories={categories}
          prefill={{
            amount: activeCandidate.amount,
            categoryId: activeCandidate.categoryId,
            accountId: activeCandidate.accountId,
            merchant: activeCandidate.merchant,
          }}
          trigger={null}
          open={activeIndex !== null}
          onOpenChange={(open) => setActiveIndex(open ? activeIndex : null)}
        />
      ) : null}
    </div>
  );
}
