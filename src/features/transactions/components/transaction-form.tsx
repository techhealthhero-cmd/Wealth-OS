"use client";

import { cloneElement, useActionState, useEffect, useMemo, useState, type ReactElement } from "react";
import { toast } from "sonner";

import { createTransaction, updateTransaction } from "@/features/transactions/actions";
import { formatMoney, parseMoneyToCents } from "@/lib/financial/money";
import { toLocalDateString } from "@/lib/date";
import { transactionTypeVisual } from "@/lib/transaction-ui";
import { useTranslation } from "@/i18n/client";
import type { Account, Category, Transaction, TransactionType } from "@/types/database";
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
import { CategoryPicker } from "./category-picker";
import { AccountPicker } from "./account-picker";
import { DateField } from "./date-field";
import { CollapsibleNotes } from "./collapsible-notes";
import { useMinimizableFormActions } from "@/components/shared/minimizable-form-context";
import { MinimizableFormShell } from "@/components/shared/minimizable-form-shell";

const LAST_ACCOUNT_KEY = "wealthos:lastAccountId";

const EDITABLE_TYPES: TransactionType[] = [
  "expense",
  "income",
  "refund",
  "debt_payment",
  "savings_transfer",
  "investment_allocation",
];

function todayISO() {
  return toLocalDateString(new Date());
}

/** Best-effort parse for the live "Save ฿250" button label — never throws on a half-typed amount. */
function safeAmountCents(raw: string): number {
  if (!raw || Number.isNaN(Number(raw))) return 0;
  try {
    return parseMoneyToCents(raw);
  } catch {
    return 0;
  }
}

function readLastAccountId(): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(LAST_ACCOUNT_KEY);
  } catch {
    return null;
  }
}

function rememberAccountId(id: string) {
  try {
    window.localStorage.setItem(LAST_ACCOUNT_KEY, id);
  } catch {
    // Private browsing / storage disabled — fine to skip, it's just a convenience default.
  }
}

/** Values used to prefill a brand-new transaction (e.g. "quick repeat") — never triggers edit/update mode. */
export interface TransactionPrefill {
  amount?: string;
  categoryId?: string | null;
  accountId?: string;
  merchant?: string | null;
}

interface TransactionFormProps {
  defaultType: Exclude<TransactionType, "transfer">;
  accounts: Account[];
  categories: Category[];
  transaction?: Transaction;
  prefill?: TransactionPrefill;
  /**
   * When provided, a new (never editing) transaction's type selector also
   * offers "transfer" — picking it calls this with the amount typed so far
   * instead of setting local type state (a transfer needs two accounts and
   * no category, so it can't just become another value of this same form;
   * see the caller, e.g. QuickAdd, for how it opens a real TransferForm
   * with that amount carried over).
   */
  onSwitchToTransfer?: (amount: string) => void;
  trigger: React.ReactElement | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Thin trigger/open-state wrapper — see goal-form.tsx for why the fields live in a separate, fully self-contained subcomponent. */
export function TransactionForm({
  defaultType,
  accounts,
  categories,
  transaction,
  prefill,
  onSwitchToTransfer,
  trigger,
  open,
  onOpenChange,
}: TransactionFormProps) {
  const { t } = useTranslation();
  const { openForm, close: closeMinimizable } = useMinimizableFormActions();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const sheetOpen = isControlled ? open : uncontrolledOpen;
  const setSheetOpen = isControlled ? onOpenChange! : setUncontrolledOpen;

  const formId = transaction ? `transaction-form-edit-${transaction.id}` : "transaction-form-add";
  // For the floating pill's label only (shown while minimized) — the
  // in-form header (built inside TransactionFormFields) reflects the
  // live `type` selection instead, since that's internal state this
  // thin wrapper deliberately doesn't own. See goal-form.tsx.
  const pillTitle = transaction
    ? t("transactions.editTransaction")
    : t(`transactions.add${defaultType === "income" ? "Income" : "Expense"}`);

  useEffect(() => {
    if (sheetOpen) {
      openForm({
        id: formId,
        title: pillTitle,
        content: (
          <TransactionFormFields
            defaultType={defaultType}
            accounts={accounts}
            categories={categories}
            transaction={transaction}
            prefill={prefill}
            onSwitchToTransfer={onSwitchToTransfer}
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

function TransactionFormFields({
  defaultType,
  accounts,
  categories,
  transaction,
  prefill,
  onSwitchToTransfer,
  onOpenChange,
}: {
  defaultType: Exclude<TransactionType, "transfer">;
  accounts: Account[];
  categories: Category[];
  transaction?: Transaction;
  prefill?: TransactionPrefill;
  onSwitchToTransfer?: (amount: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { close: closeMinimizable } = useMinimizableFormActions();

  const isCreating = !transaction;
  const [type, setType] = useState<TransactionType>(transaction?.type ?? defaultType);
  const [amount, setAmount] = useState(
    transaction?.amount ? String(transaction.amount) : prefill?.amount ? String(prefill.amount) : ""
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    transaction?.category_id ?? prefill?.categoryId ?? null
  );
  const [accountId, setAccountId] = useState<string | undefined>(
    // `accounts` includes archived ones (so past transactions still render
    // correctly elsewhere) — a brand-new transaction with no explicit
    // account yet must default to an active one, never silently fall back
    // to `accounts[0]` if that happens to be archived. Editing an existing
    // transaction keeps its real account regardless of archived status —
    // that's not a "default," it's the transaction's actual history.
    transaction?.account_id ?? prefill?.accountId ?? accounts.find((a) => !a.is_archived)?.id ?? accounts[0]?.id
  );
  const [dateValue, setDateValue] = useState(transaction?.transaction_date ?? todayISO());
  // One idempotency key per intended submit attempt (see CLAUDE.md
  // "TRANSACTION IDEMPOTENCY"): generated once when this form instance
  // mounts, resent unchanged on every retry of the SAME attempt, and
  // rotated only after a successful save so the next intentional entry
  // gets its own fresh key — see the effect below. Only meaningful for a
  // new transaction; editing doesn't create a new financial event.
  const [clientRequestId, setClientRequestId] = useState(() => crypto.randomUUID());

  const action = transaction ? updateTransaction.bind(null, transaction.id) : createTransaction;
  const [state, formAction, isPending] = useActionState(action, undefined);

  function handleClose() {
    onOpenChange(false);
    closeMinimizable();
  }

  // Smart default (Step 4): prefer the most recently used account for a
  // brand-new transaction, once there's more than one to choose between (a
  // single account is already the initial state, above). Deferred to an
  // effect — not computed during render — because localStorage is a browser
  // API unavailable during the server render pass; reading it here, after
  // mount, is the correct place to hydrate from it, hence the rule override.
  useEffect(() => {
    if (!isCreating || accounts.length < 2 || prefill?.accountId) return;
    const last = readLastAccountId();
    if (last && accounts.some((a) => a.id === last && !a.is_archived)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAccountId(last);
    }
    // Only run once, when the sheet first has accounts to work with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreating, accounts.length > 1]);

  useEffect(() => {
    if (!state?.success) return;
    handleClose();
    if (accountId) rememberAccountId(accountId);
    // Next open of this same form instance is a NEW intended transaction —
    // it must get its own idempotency key, never reuse the one that just
    // succeeded (reusing it would make the next real save silently no-op
    // against the unique index instead of creating a new row).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClientRequestId(crypto.randomUUID());

    const cents = safeAmountCents(amount);
    const formatted = formatMoney(cents);
    const toastText =
      type === "income"
        ? `${t("transactions.savedIncome")} ${formatted}`
        : `${t("transactions.savedExpense")} ${formatted}`;
    toast.success(toastText, { icon: <SuccessBadge /> });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const relevantCategories = useMemo(() => {
    const categoryType = type === "income" || type === "refund" ? "income" : "expense";
    return categories.filter((c) => c.type === categoryType || c.type === "both");
  }, [categories, type]);

  const visual = transactionTypeVisual(type);
  const amountCents = safeAmountCents(amount);
  const canSubmit = amountCents > 0 && Boolean(accountId) && accounts.length > 0 && !isPending;

  const merchantLabel =
    type === "income"
      ? t("transactions.merchantIncomeLabel")
      : t("transactions.merchantExpenseLabel");
  const merchantPlaceholder =
    type === "income"
      ? t("transactions.merchantIncomePlaceholder")
      : t("transactions.merchantExpensePlaceholder");

  const saveLabelPrefix = type === "income" ? t("transactions.saveIncome") : t("transactions.saveExpense");
  const saveLabel = amountCents > 0 ? `${saveLabelPrefix} ${formatMoney(amountCents)}` : saveLabelPrefix;

  // "transfer" only ever appears as a type choice while creating (never
  // editing — an existing row's type can't become a transfer through this
  // form; see update_transfer/TransferForm for that), and only once the
  // caller both offers somewhere to send it (onSwitchToTransfer) and
  // there are at least two accounts to transfer between.
  const canOfferTransfer = isCreating && Boolean(onSwitchToTransfer) && accounts.length >= 2;
  const typeOptions: TransactionType[] = canOfferTransfer ? [...EDITABLE_TYPES, "transfer"] : EDITABLE_TYPES;

  function handleTypeChange(v: TransactionType | null) {
    if (!v) return;
    if (v === "transfer") {
      onSwitchToTransfer?.(amount);
      return;
    }
    setType(v);
  }

  const title = (
    <>
      <span
        className={`inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium ${visual.colorClass}`}
      >
        <span aria-hidden="true">{visual.emoji}</span>
        {t(`transactions.types.${type}`)}
      </span>
      <p className="font-heading text-base leading-tight font-medium">
        {transaction ? t("transactions.editTransaction") : t(`transactions.add${type === "income" ? "Income" : "Expense"}`)}
      </p>
    </>
  );

  return (
    <MinimizableFormShell title={title} onClose={handleClose} variant="sheet">
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="account_id" value={accountId ?? ""} />
        {isCreating ? <input type="hidden" name="client_request_id" value={clientRequestId} /> : null}

        <div className="space-y-2">
          <Label htmlFor="type-select">{t("transactions.type")}</Label>
          <Select value={type} onValueChange={handleTypeChange}>
            <SelectTrigger id="type-select">
              <SelectValue>{(value: TransactionType) => t(`transactions.types.${value}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((tOption) => (
                <SelectItem key={tOption} value={tOption}>
                  {t(`transactions.types.${tOption}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <AmountInput
          name="__amount_display"
          value={amount}
          onValueChange={setAmount}
          aria-label={t("transactions.amount")}
          autoFocus={isCreating}
        />
        {/* The real submitted field: always a plain decimal string, kept in sync with the big display input above. */}
        <input type="hidden" name="amount" value={amount} />

        <CategoryPicker
          name="category_id"
          categories={relevantCategories}
          value={categoryId}
          onValueChange={setCategoryId}
        />

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="account_display" className="sr-only">
              {t("transactions.account")}
            </Label>
            <AccountPicker
              id="account_display"
              name="__account_display"
              accounts={accounts}
              value={accountId}
              onValueChange={setAccountId}
            />
          </div>
          <DateField name="transaction_date" value={dateValue} onValueChange={setDateValue} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="merchant">{merchantLabel}</Label>
          <Input
            id="merchant"
            name="merchant"
            defaultValue={transaction?.merchant ?? prefill?.merchant ?? ""}
            placeholder={merchantPlaceholder}
            maxLength={120}
          />
        </div>

        <CollapsibleNotes
          name="notes"
          defaultValue={transaction?.notes ?? ""}
          // 2026-09: for an expense, the "merchant" field above is now
          // framed as "what did you pay for" (see merchantLabel) — notes
          // takes over the "who did you pay" framing that field used to
          // carry, rather than staying a generic note field. Income/
          // transfer keep the generic defaults (transfer-form.tsx's own
          // CollapsibleNotes usage is untouched).
          toggleLabel={type === "expense" ? t("transactions.payeeExpenseLabel") : undefined}
          placeholder={type === "expense" ? t("transactions.payeeExpensePlaceholder") : undefined}
        />

        {state?.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        {accounts.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">{t("transactions.needAccountFirst")}</p>
        ) : (
          <Button type="submit" className="w-full" size="lg" disabled={!canSubmit}>
            {isPending ? t("transactions.saving") : saveLabel}
          </Button>
        )}
      </form>
    </MinimizableFormShell>
  );
}
