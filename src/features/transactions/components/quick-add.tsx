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
import { TransactionForm, type TransactionPrefill } from "./transaction-form";
import { TransferForm } from "./transfer-form";
import { QuickCaptureSheet } from "@/features/capture/components/quick-capture-sheet";
import { asTrigger } from "@/lib/as-trigger";
import { useTranslation } from "@/i18n/client";

type QuickAddDialog = "expense" | "income" | "transfer" | null;

interface QuickAddProps {
  accounts: Account[];
  categories: Category[];
  /**
   * "row" is 3 always-visible tiles (income/expense/transfer) instead of
   * one button behind a dropdown menu — same dialogs underneath.
   * "nav-center" renders an invisible-content trigger sized to fill a
   * bottom-nav cell — BottomNav draws the actual visible raised "+" circle
   * itself (same treatment as its tab bumps) and layers this underneath it
   * as the real click target, so the two move as one piece instead of a
   * separately-positioned floating button drifting out of sync with the
   * nav's own layout.
   */
  variant?: "nav-center" | "inline" | "row";
}

type PendingSwitch = { dialog: Exclude<QuickAddDialog, null>; amount: string } | null;

export function QuickAdd({ accounts, categories, variant = "inline" }: QuickAddProps) {
  const { t } = useTranslation();
  const [activeDialog, setActiveDialog] = useState<QuickAddDialog>(null);
  const [carryOverAmount, setCarryOverAmount] = useState<string | undefined>(undefined);
  const [pendingSwitch, setPendingSwitch] = useState<PendingSwitch>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  // Set only by Quick Capture's "manual entry" hand-off; any other open
  // clears it so an unrelated later open never inherits captured values.
  const [manualPrefill, setManualPrefill] = useState<TransactionPrefill | null>(null);

  // A fresh, direct open (FAB / dropdown item / tile) must never inherit an
  // amount left over from an earlier, unrelated switch.
  function openDialog(dialog: Exclude<QuickAddDialog, null>) {
    setCarryOverAmount(undefined);
    setManualPrefill(null);
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
    setManualPrefill(null);
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
              // Requested (2026-09-29): expense first — it's the most
              // frequent entry, so it gets the leading tile.
              { dialog: "expense" as const, icon: CircleMinus, tone: "rose" as const, label: t("transactions.types.expense") },
              { dialog: "income" as const, icon: CirclePlus, tone: "mint" as const, label: t("transactions.types.income") },
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
      ) : variant === "nav-center" ? (
        // The center "+" now opens Quick Capture ("capture first, organize
        // later") instead of the Expense/Income/Transfer menu — that menu's
        // three options all remain inside the sheet (manual entry, income,
        // transfer). Invisible on purpose — BottomNav renders the visible
        // raised "+" circle above this exact spot; this is only the real
        // click target, sized like a normal nav cell.
        <button
          type="button"
          onClick={() => setCaptureOpen(true)}
          className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-medium"
          aria-label={t("capture.title")}
          aria-haspopup="dialog"
        >
          <Plus className="h-5 w-5 opacity-0" aria-hidden="true" />
          <span className="invisible">+</span>
        </button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            {...asTrigger(
              <Button>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("dashboard.quickAdd")}
              </Button>
            )}
          />
          <DropdownMenuContent align="center" side="bottom">
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
        prefill={manualPrefill ?? { amount: carryOverAmount }}
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
      {variant === "nav-center" ? (
        <QuickCaptureSheet
          open={captureOpen}
          onOpenChange={setCaptureOpen}
          accounts={accounts}
          categories={categories}
          onManual={(prefill) => {
            setManualPrefill(prefill);
            setCarryOverAmount(undefined);
            setActiveDialog("expense");
          }}
          onIncome={() => openDialog("income")}
          onTransfer={() => openDialog("transfer")}
        />
      ) : null}
    </>
  );
}
