"use client";

import { cloneElement, useActionState, useEffect, useState, type ReactElement } from "react";
import { ArrowDown } from "lucide-react";
import { toast } from "sonner";

import { createTransfer, updateTransfer } from "@/features/transactions/actions";
import { formatMoney, parseMoneyToCents } from "@/lib/financial/money";
import { toLocalDateString } from "@/lib/date";
import { transactionTypeVisual } from "@/lib/transaction-ui";
import { useTranslation } from "@/i18n/client";
import type { Account, Transaction } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SuccessBadge } from "@/components/illustrations";
import { AmountInput } from "./amount-input";
import { AccountPicker } from "./account-picker";
import { DateField } from "./date-field";
import { CollapsibleNotes } from "./collapsible-notes";
import { useMinimizableFormActions } from "@/components/shared/minimizable-form-context";
import { MinimizableFormShell } from "@/components/shared/minimizable-form-shell";
import { CREATE_TYPE_OPTIONS } from "./transaction-form";

function todayISO() {
  return toLocalDateString(new Date());
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
  /** Present to edit an existing transfer in place (update_transfer RPC, migration 0015) rather than create a new one. */
  transfer?: Transaction;
  /** Carries an amount over from another form the user switched away from (see TransactionForm's onSwitchToTransfer) — ignored once `transfer` is set, since editing always uses the real row's amount. */
  prefillAmount?: string;
  /**
   * When provided, a new (never editing) transfer's type selector also
   * offers "expense"/"income" — picking one calls this with the amount
   * typed so far instead of trying to submit a transfer, mirroring
   * TransactionForm's own onSwitchToTransfer in the other direction.
   */
  onSwitchToTransaction?: (type: "income" | "expense", amount: string) => void;
  trigger: React.ReactElement | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Thin trigger/open-state wrapper — see goal-form.tsx for why the fields live in a separate, fully self-contained subcomponent. */
export function TransferForm({
  accounts,
  transfer,
  prefillAmount,
  onSwitchToTransaction,
  trigger,
  open,
  onOpenChange,
}: TransferFormProps) {
  const { t } = useTranslation();
  const { openForm, close: closeMinimizable } = useMinimizableFormActions();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const sheetOpen = isControlled ? open : uncontrolledOpen;
  const setSheetOpen = isControlled ? onOpenChange! : setUncontrolledOpen;

  const formId = transfer ? `transfer-form-edit-${transfer.id}` : "transfer-form-add";
  const pillTitle = transfer ? t("transactions.editTransaction") : t("transactions.addTransfer");

  useEffect(() => {
    if (sheetOpen) {
      openForm({
        id: formId,
        title: pillTitle,
        content: (
          <TransferFormFields
            accounts={accounts}
            transfer={transfer}
            prefillAmount={prefillAmount}
            onSwitchToTransaction={onSwitchToTransaction}
            onOpenChange={setSheetOpen}
          />
        ),
      });
    } else {
      closeMinimizable();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen]);

  if (trigger === null) return null;

  return cloneElement(trigger as ReactElement<{ onClick?: () => void }>, {
    onClick: () => setSheetOpen(true),
  });
}

function TransferFormFields({
  accounts,
  transfer,
  prefillAmount,
  onSwitchToTransaction,
  onOpenChange,
}: {
  accounts: Account[];
  transfer?: Transaction;
  prefillAmount?: string;
  onSwitchToTransaction?: (type: "income" | "expense", amount: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { close: closeMinimizable } = useMinimizableFormActions();

  const isEditing = Boolean(transfer);
  const action = transfer ? updateTransfer.bind(null, transfer.id) : createTransfer;
  const [state, formAction, isPending] = useActionState(action, undefined);

  // `accounts` includes archived ones (so historic transfers still render
  // correctly elsewhere) — a NEW transfer must default to active accounts
  // only, never silently pick an archived one just because it's first/
  // second in the array. Editing an existing transfer keeps its real
  // accounts regardless of archived status — that's not a "default," it's
  // the transfer's actual history (same rule transaction-form.tsx applies).
  const activeAccounts = accounts.filter((a) => !a.is_archived);
  const [amount, setAmount] = useState(transfer ? String(transfer.amount) : (prefillAmount ?? ""));
  const [fromAccountId, setFromAccountId] = useState<string | undefined>(
    transfer?.from_account_id ?? activeAccounts[0]?.id ?? accounts[0]?.id
  );
  const [toAccountId, setToAccountId] = useState<string | undefined>(
    transfer?.to_account_id ?? activeAccounts[1]?.id ?? accounts[1]?.id
  );
  const [dateValue, setDateValue] = useState(transfer?.transaction_date ?? todayISO());
  // Same idempotency-key pattern as transaction-form.tsx — see CLAUDE.md
  // "TRANSACTION IDEMPOTENCY". Only meaningful for a new transfer; editing
  // doesn't create a new financial event (update_transfer needs no key —
  // see actions.ts's updateTransfer doc comment).
  const [clientRequestId, setClientRequestId] = useState(() => crypto.randomUUID());

  function handleClose() {
    onOpenChange(false);
    closeMinimizable();
  }

  useEffect(() => {
    if (!state?.success) return;
    handleClose();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClientRequestId(crypto.randomUUID());
    toast.success(t("transactions.savedTransfer"), { icon: <SuccessBadge /> });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const canTransfer = accounts.length >= 2;
  const amountCents = safeAmountCents(amount);
  const sameAccount = Boolean(fromAccountId) && fromAccountId === toAccountId;
  const canSubmit =
    amountCents > 0 && Boolean(fromAccountId) && Boolean(toAccountId) && !sameAccount && !isPending;

  // Same three-way switch as TransactionForm's own type selector, shown
  // only while creating (never editing — an existing transfer can't
  // become a plain transaction through this form).
  function handleTypeChange(v: string | null) {
    if (!v || v === "transfer") return;
    onSwitchToTransaction?.(v as "income" | "expense", amount);
  }

  const visual = transactionTypeVisual("transfer");
  const saveLabelPrefix = t("transactions.saveTransfer");
  const saveLabel = amountCents > 0 ? `${saveLabelPrefix} ${formatMoney(amountCents)}` : saveLabelPrefix;

  const title = (
    <>
      <span
        className={`inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium ${visual.colorClass}`}
      >
        <span aria-hidden="true">{visual.emoji}</span>
        {t("transactions.types.transfer")}
      </span>
      <p className="font-heading text-base leading-tight font-medium">
        {transfer ? t("transactions.editTransaction") : t("transactions.addTransfer")}
      </p>
    </>
  );

  return (
    <MinimizableFormShell title={title} onClose={handleClose} variant="sheet">
      {!canTransfer ? (
        <p className="text-sm text-muted-foreground">{t("transactions.needTwoAccountsForTransfer")}</p>
      ) : (
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="from_account_id" value={fromAccountId ?? ""} />
          <input type="hidden" name="to_account_id" value={toAccountId ?? ""} />
          {isEditing ? null : <input type="hidden" name="client_request_id" value={clientRequestId} />}

          {isEditing ? null : (
            <div className="space-y-2">
              <Label htmlFor="type-select">{t("transactions.type")}</Label>
              <Select value="transfer" onValueChange={handleTypeChange}>
                <SelectTrigger id="type-select">
                  <SelectValue>{(value: string) => t(`transactions.types.${value}`)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CREATE_TYPE_OPTIONS.map((tOption) => (
                    <SelectItem key={tOption} value={tOption}>
                      {t(`transactions.types.${tOption}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <AmountInput
            name="__amount_display"
            value={amount}
            onValueChange={setAmount}
            aria-label={t("transactions.amount")}
            autoFocus={!isEditing}
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
            <Input id="description" name="description" defaultValue={transfer?.description ?? ""} maxLength={200} />
          </div>

          <CollapsibleNotes name="notes" defaultValue={transfer?.notes ?? ""} />

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
    </MinimizableFormShell>
  );
}
