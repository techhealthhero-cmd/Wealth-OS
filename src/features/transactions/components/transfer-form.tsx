"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowDown } from "lucide-react";
import { toast } from "sonner";

import { createTransfer } from "@/features/transactions/actions";
import { asTrigger } from "@/lib/as-trigger";
import { formatMoney, parseMoneyToCents } from "@/lib/financial/money";
import { transactionTypeVisual } from "@/lib/transaction-ui";
import { useTranslation } from "@/i18n/client";
import type { Account } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SuccessBadge } from "@/components/illustrations";
import { AmountInput } from "./amount-input";
import { AccountPicker } from "./account-picker";
import { DateField } from "./date-field";
import { CollapsibleNotes } from "./collapsible-notes";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function safeAmountCents(raw: string): number {
  if (!raw || Number.isNaN(Number(raw))) return 0;
  try {
    return parseMoneyToCents(raw);
  } catch {
    return 0;
  }
}

interface TransferFormProps {
  accounts: Account[];
  trigger: React.ReactElement | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function TransferForm({ accounts, trigger, open, onOpenChange }: TransferFormProps) {
  const { t } = useTranslation();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const sheetOpen = isControlled ? open : uncontrolledOpen;
  const setSheetOpen = isControlled ? onOpenChange! : setUncontrolledOpen;

  const [state, formAction, isPending] = useActionState(createTransfer, undefined);

  const [amount, setAmount] = useState("");
  const [fromAccountId, setFromAccountId] = useState<string | undefined>(accounts[0]?.id);
  const [toAccountId, setToAccountId] = useState<string | undefined>(accounts[1]?.id);
  const [dateValue, setDateValue] = useState(todayISO());

  useEffect(() => {
    if (!state?.success) return;
    setSheetOpen(false);
    toast.success(t("transactions.savedTransfer"), { icon: <SuccessBadge /> });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.success]);

  const canTransfer = accounts.length >= 2;
  const amountCents = safeAmountCents(amount);
  const sameAccount = Boolean(fromAccountId) && fromAccountId === toAccountId;
  const canSubmit =
    amountCents > 0 && Boolean(fromAccountId) && Boolean(toAccountId) && !sameAccount && !isPending;

  const visual = transactionTypeVisual("transfer");
  const saveLabel = amountCents > 0 ? `${t("transactions.saveTransfer")} ${formatMoney(amountCents)}` : t("transactions.saveTransfer");

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      {trigger !== null ? <SheetTrigger {...asTrigger(trigger)} /> : null}
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[92vh] w-full overflow-y-auto rounded-t-2xl sm:max-w-md sm:rounded-2xl sm:border"
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-muted sm:hidden" aria-hidden="true" />
        <SheetHeader className="pb-0">
          <span
            className={`inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium ${visual.colorClass}`}
          >
            <span aria-hidden="true">{visual.emoji}</span>
            {t("transactions.types.transfer")}
          </span>
          <SheetTitle>{t("transactions.addTransfer")}</SheetTitle>
        </SheetHeader>

        {!canTransfer ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">
            {t("transactions.needTwoAccountsForTransfer")}
          </p>
        ) : (
          <form action={formAction} className="space-y-5 px-4 pb-4">
            <input type="hidden" name="from_account_id" value={fromAccountId ?? ""} />
            <input type="hidden" name="to_account_id" value={toAccountId ?? ""} />

            <AmountInput
              name="__amount_display"
              value={amount}
              onValueChange={setAmount}
              aria-label={t("transactions.amount")}
              autoFocus
            />
            <input type="hidden" name="amount" value={amount} />

            <div className="space-y-2">
              <Label htmlFor="from_account_display">{t("transactions.fromAccount")}</Label>
              <AccountPicker
                id="from_account_display"
                name="__from_display"
                accounts={accounts}
                value={fromAccountId}
                onValueChange={setFromAccountId}
              />
            </div>

            <div className="flex justify-center" aria-hidden="true">
              <ArrowDown className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="to_account_display">{t("transactions.toAccount")}</Label>
              <AccountPicker
                id="to_account_display"
                name="__to_display"
                accounts={accounts}
                value={toAccountId}
                onValueChange={setToAccountId}
              />
            </div>
            {sameAccount ? (
              <p className="text-sm text-destructive">{t("validation.sameAccountTransfer")}</p>
            ) : null}

            <DateField name="transaction_date" value={dateValue} onValueChange={setDateValue} />

            <div className="space-y-1.5">
              <Label htmlFor="description">{t("transactions.description")}</Label>
              <Input id="description" name="description" maxLength={200} />
            </div>

            <CollapsibleNotes name="notes" />

            {state?.error ? (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" size="lg" disabled={!canSubmit}>
              {isPending ? t("transactions.saving") : saveLabel}
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
