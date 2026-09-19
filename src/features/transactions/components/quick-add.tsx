"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, CircleMinus, CirclePlus, Plus, TrendingDown, TrendingUp } from "lucide-react";

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

type PendingSwitch = { dialog: Exclude<QuickAddDialog, null>; amount: string } | null;

export function QuickAdd({ accounts, categories, variant = "floating" }: QuickAddProps) {
  const { t } = useTranslation();
  const [activeDialog, setActiveDialog] = useState<QuickAddDialog>(null);
  const [carryOverAmount, setCarryOverAmount] = useState<string | undefined>(undefined);
  const [pendingSwitch, setPendingSwitch] = useState<PendingSwitch>(null);

  // A fresh, direct open (FAB / dropdown item / tile) must never inherit an
  // amount left over from an earlier, unrelated switch.
  function openDialog(dialog: Exclude<QuickAddDialog, null>) {
    setCarryOverAmount(undefined);
    setActiveDialog(dialog);
  }

  // Lets someone who opened "add expense"/"add income"/"transfer" change
  // their mind to a different one of the three without retyping the
  // amount — see TransactionForm's onSwitchToTransfer and TransferForm's
  // onSwitchToTransaction. Setting `activeDialog` straight to the new
  // value would flip the old form's `open` prop to false and the new
  // form's to true in the SAME render, but they're separate sibling
  // components — nothing guarantees the old one's close() effect runs
  // before the new one's openForm() effect, and MinimizableFormProvider's
  // openForm() deliberately refuses to replace a still-active different
  // form (its usual protection against an unrelated navigation silently
  // discarding an in-progress draft elsewhere). So this closes first
  // (`activeDialog(null)`), and only opens the target once that close has
  // actually landed, via the effect below reacting on the NEXT render —
  // two separate commits, so ordering between forms never matters.
  function requestSwitch(dialog: Exclude<QuickAddDialog, null>, amount: string) {
    setPendingSwitch({ dialog, amount });
    setActiveDialog(null);
  }

  useEffect(() => {
    if (!pendingSwitch) return;
    // Deliberately synchronous: this MUST land as a render strictly after
    // the one that closed the previous form, not be folded into it — see
    // requestSwitch's comment for why that separation is the whole point.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCarryOverAmount(pendingSwitch.amount);
    setActiveDialog(pendingSwitch.dialog);
    setPendingSwitch(null);
  }, [pendingSwitch]);

  return (
    <>
      {variant === "row" ? (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {(
            [
              { dialog: "income" as const, icon: CirclePlus, tone: "mint" as const, label: t("transactions.types.income") },
              { dialog: "expense" as const, icon: CircleMinus, tone: "rose" as const, label: t("transactions.types.expense") },
              { dialog: "transfer" as const, icon: ArrowLeftRight, tone: "lavender" as const, label: t("transactions.types.transfer") },
            ]
          ).map((item) => (
            <button
              key={item.dialog}
              type="button"
              onClick={() => openDialog(item.dialog)}
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
            <DropdownMenuItem onClick={() => openDialog("expense")}>
              <TrendingDown className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("transactions.types.expense")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openDialog("income")}>
              <TrendingUp className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("transactions.types.income")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openDialog("transfer")}>
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
        prefill={{ amount: carryOverAmount }}
        onSwitchToTransfer={(amount) => requestSwitch("transfer", amount)}
        trigger={null}
        open={activeDialog === "expense"}
        onOpenChange={(open) => setActiveDialog(open ? "expense" : null)}
      />
      <TransactionForm
        defaultType="income"
        accounts={accounts}
        categories={categories}
        prefill={{ amount: carryOverAmount }}
        onSwitchToTransfer={(amount) => requestSwitch("transfer", amount)}
        trigger={null}
        open={activeDialog === "income"}
        onOpenChange={(open) => setActiveDialog(open ? "income" : null)}
      />
      <TransferForm
        accounts={accounts}
        prefillAmount={carryOverAmount}
        onSwitchToTransaction={(type, amount) => requestSwitch(type, amount)}
        trigger={null}
        open={activeDialog === "transfer"}
        onOpenChange={(open) => setActiveDialog(open ? "transfer" : null)}
      />
    </>
  );
}
