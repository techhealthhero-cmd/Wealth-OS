"use client";

import { useState } from "react";
import { ArrowLeftRight, Plus, TrendingDown, TrendingUp } from "lucide-react";

import type { Account, Category } from "@/types/database";
import { Button } from "@/components/ui/button";
import { IconChip } from "@/components/shared/icon-chip";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TransactionForm } from "./transaction-form";
import { TransferForm } from "./transfer-form";
import { asTrigger } from "@/lib/as-trigger";
import { useTranslation } from "@/i18n/client";

type QuickAddDialog = "expense" | "income" | "transfer" | null;

interface QuickAddProps {
  accounts: Account[];
  categories: Category[];
  /** "row" is 3 always-visible tiles (income/expense/transfer) instead of one button behind a dropdown menu — same dialogs underneath. */
  variant?: "floating" | "inline" | "row";
}

export function QuickAdd({ accounts, categories, variant = "floating" }: QuickAddProps) {
  const { t } = useTranslation();
  const [activeDialog, setActiveDialog] = useState<QuickAddDialog>(null);

  return (
    <>
      {variant === "row" ? (
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              { dialog: "income" as const, icon: TrendingUp, tone: "mint" as const, label: t("transactions.types.income") },
              { dialog: "expense" as const, icon: TrendingDown, tone: "rose" as const, label: t("transactions.types.expense") },
              { dialog: "transfer" as const, icon: ArrowLeftRight, tone: "lavender" as const, label: t("transactions.types.transfer") },
            ]
          ).map((item) => (
            <button
              key={item.dialog}
              type="button"
              onClick={() => setActiveDialog(item.dialog)}
              className={cn(
                "card-interactive flex flex-col items-center gap-2 rounded-xl bg-card py-4 text-card-foreground shadow-card ring-1 ring-foreground/5",
                "transition-colors hover:bg-accent/50"
              )}
            >
              <IconChip icon={item.icon} tone={item.tone} className="size-10" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            {...asTrigger(
              variant === "floating" ? (
                <Button
                  size="icon"
                  className="fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full shadow-lg md:bottom-6"
                  aria-label={t("dashboard.quickAdd")}
                >
                  <Plus className="h-6 w-6" aria-hidden="true" />
                </Button>
              ) : (
                <Button>
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t("dashboard.quickAdd")}
                </Button>
              )
            )}
          />
          <DropdownMenuContent align="end" side={variant === "floating" ? "top" : "bottom"}>
            <DropdownMenuItem onClick={() => setActiveDialog("expense")}>
              <TrendingDown className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("transactions.types.expense")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveDialog("income")}>
              <TrendingUp className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("transactions.types.income")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveDialog("transfer")}>
              <ArrowLeftRight className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("transactions.types.transfer")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <TransactionForm
        defaultType="expense"
        accounts={accounts}
        categories={categories}
        trigger={null}
        open={activeDialog === "expense"}
        onOpenChange={(open) => setActiveDialog(open ? "expense" : null)}
      />
      <TransactionForm
        defaultType="income"
        accounts={accounts}
        categories={categories}
        trigger={null}
        open={activeDialog === "income"}
        onOpenChange={(open) => setActiveDialog(open ? "income" : null)}
      />
      <TransferForm
        accounts={accounts}
        trigger={null}
        open={activeDialog === "transfer"}
        onOpenChange={(open) => setActiveDialog(open ? "transfer" : null)}
      />
    </>
  );
}
