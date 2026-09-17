"use client";

import { useEffect, useState, useActionState } from "react";

import { createRecurringTransaction, updateRecurringTransaction } from "@/features/recurring/actions";
import { RECURRING_TYPES, RECURRING_FREQUENCIES } from "@/lib/validation/recurring-transaction";
import { useTranslation } from "@/i18n/client";
import type { Account, Category, RecurringTransaction } from "@/types/database";
import { AccountPicker } from "@/features/transactions/components/account-picker";
import { CategoryPicker } from "@/features/transactions/components/category-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { asTrigger } from "@/lib/as-trigger";

interface RecurringTransactionFormProps {
  recurring?: RecurringTransaction;
  accounts: Account[];
  categories: Category[];
  trigger?: React.ReactElement | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function RecurringTransactionForm({ recurring, accounts, categories, trigger, open, onOpenChange }: RecurringTransactionFormProps) {
  const { t } = useTranslation();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : uncontrolledOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setUncontrolledOpen;

  const [type, setType] = useState<string>(recurring?.type ?? "expense");
  const [accountId, setAccountId] = useState<string | undefined>(recurring?.account_id ?? accounts[0]?.id);
  const [fromAccountId, setFromAccountId] = useState<string | undefined>(recurring?.from_account_id ?? accounts[0]?.id);
  const [toAccountId, setToAccountId] = useState<string | undefined>(recurring?.to_account_id ?? accounts[1]?.id);
  const [categoryId, setCategoryId] = useState<string | null>(recurring?.category_id ?? null);

  const action = recurring ? updateRecurringTransaction.bind(null, recurring.id) : createRecurringTransaction;
  const [state, formAction, isPending] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.success) setDialogOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {trigger !== null ? (
        <DialogTrigger
          {...asTrigger(
            trigger ?? (
              <Button>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("recurring.addRecurring")}
              </Button>
            )
          )}
        />
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{recurring ? t("recurring.editRecurring") : t("recurring.addRecurring")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {type === "transfer" ? (
            <>
              <input type="hidden" name="from_account_id" value={fromAccountId ?? ""} />
              <input type="hidden" name="to_account_id" value={toAccountId ?? ""} />
            </>
          ) : (
            <input type="hidden" name="account_id" value={accountId ?? ""} />
          )}
          <input type="hidden" name="category_id" value={categoryId ?? ""} />

          <div className="space-y-2">
            <Label htmlFor="type">{t("recurring.type")}</Label>
            <Select name="type" value={type} onValueChange={(v) => v && setType(v)}>
              <SelectTrigger id="type">
                <SelectValue>{(value: string) => t(`recurring.types.${value}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {RECURRING_TYPES.map((rt) => (
                  <SelectItem key={rt} value={rt}>
                    {t(`recurring.types.${rt}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">{t("recurring.amount")}</Label>
            <Input id="amount" name="amount" type="number" step="any" min="0.01" defaultValue={recurring?.amount ?? ""} required />
          </div>

          {type === "transfer" ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("recurring.fromAccount")}</Label>
                <AccountPicker name="from_account_id_display" accounts={accounts} value={fromAccountId} onValueChange={setFromAccountId} />
              </div>
              <div className="space-y-2">
                <Label>{t("recurring.toAccount")}</Label>
                <AccountPicker name="to_account_id_display" accounts={accounts} value={toAccountId} onValueChange={setToAccountId} />
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>{t("recurring.account")}</Label>
                <AccountPicker name="account_id_display" accounts={accounts} value={accountId} onValueChange={setAccountId} />
              </div>
              <div className="space-y-2">
                <Label>{t("recurring.category")}</Label>
                <CategoryPicker name="category_id_display" categories={categories} value={categoryId} onValueChange={setCategoryId} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="merchant">{t("recurring.merchant")}</Label>
                <Input id="merchant" name="merchant" defaultValue={recurring?.merchant ?? ""} maxLength={120} />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">{t("recurring.description")}</Label>
            <Input id="description" name="description" defaultValue={recurring?.description ?? ""} maxLength={255} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="frequency">{t("recurring.frequency")}</Label>
            <Select name="frequency" defaultValue={recurring?.frequency ?? "monthly"}>
              <SelectTrigger id="frequency">
                <SelectValue>{(value: string) => t(`recurring.frequencies.${value}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {RECURRING_FREQUENCIES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {t(`recurring.frequencies.${f}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* min-w-0: a native date input's rendered width isn't fully
                CSS-controlled (iOS Safari renders it using the device's
                locale — a Thai Buddhist-calendar date like "15 ต.ค. 2569" is
                much wider than "15/10/2026") — without this, the grid track
                won't shrink to fit `w-full`, and a wide filled value can
                overflow into the neighboring end_date column. Same defect
                class as the account-picker overlap fixed earlier this
                session (see PROJECT_STATUS.md carried-forward lesson #14). */}
            <div className="min-w-0 space-y-2">
              <Label htmlFor="start_date">{t("recurring.startDate")}</Label>
              <Input id="start_date" name="start_date" type="date" defaultValue={recurring?.start_date ?? ""} required />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="end_date">{t("recurring.endDate")}</Label>
              <Input id="end_date" name="end_date" type="date" defaultValue={recurring?.end_date ?? ""} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="is_active" name="is_active" defaultChecked={recurring?.is_active ?? true} />
            <Label htmlFor="is_active" className="font-normal">
              {t("recurring.active")}
            </Label>
          </div>

          {state?.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? t("common.saving") : t("common.save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
