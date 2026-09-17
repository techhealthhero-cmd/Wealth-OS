"use client";

import { useActionState, useEffect, useState } from "react";

import { createAccount, updateAccount } from "@/features/accounts/actions";
import { ACCOUNT_TYPES } from "@/lib/validation/account";
import { useTranslation } from "@/i18n/client";
import type { Account } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { asTrigger } from "@/lib/as-trigger";

interface AccountFormProps {
  account?: Account;
  trigger?: React.ReactElement | null;
  /** Pass to control the dialog externally (e.g. from a dropdown menu item). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AccountForm({ account, trigger, open, onOpenChange }: AccountFormProps) {
  const { t } = useTranslation();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : uncontrolledOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setUncontrolledOpen;
  // Tracked so the credit-card-specific hint (sign convention + the
  // double-counting risk with Liabilities — see CLAUDE.md "CREDIT CARD
  // ACCOUNT SEMANTICS") can show/hide as the user picks a type, without
  // waiting for a full form submit.
  const [accountType, setAccountType] = useState(account?.account_type ?? "bank");

  const action = account ? updateAccount.bind(null, account.id) : createAccount;
  const [state, formAction, isPending] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.success) setDialogOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.success]);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {trigger !== null ? (
        <DialogTrigger
          {...asTrigger(
            trigger ?? (
              <Button>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("accounts.addAccount")}
              </Button>
            )
          )}
        />
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? t("accounts.editAccount") : t("accounts.addAccount")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("accounts.accountName")}</Label>
            <Input
              id="name"
              name="name"
              defaultValue={account?.name}
              placeholder={t("accounts.namePlaceholder")}
              required
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account_type">{t("accounts.accountType")}</Label>
            <Select name="account_type" value={accountType} onValueChange={(value) => value && setAccountType(value)}>
              <SelectTrigger id="account_type">
                <SelectValue>{(value: string) => t(`accounts.types.${value}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`accounts.types.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {accountType === "credit_card" ? (
              <p className="text-xs text-muted-foreground">{t("accounts.creditCardTypeHint")}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="institution">{`${t("accounts.institution")} (${t("common.optional")})`}</Label>
            <Input
              id="institution"
              name="institution"
              defaultValue={account?.institution ?? ""}
              placeholder={t("accounts.institutionPlaceholder")}
              maxLength={80}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="opening_balance">{t("accounts.openingBalance")}</Label>
              <Input
                id="opening_balance"
                name="opening_balance"
                type="number"
                step="0.01"
                defaultValue={account?.opening_balance ?? "0"}
                required
              />
              {account ? (
                <p className="text-xs text-muted-foreground">{t("accounts.openingBalanceEditHint")}</p>
              ) : accountType === "credit_card" ? (
                <p className="text-xs text-muted-foreground">{t("accounts.creditCardBalanceHint")}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency_code">{t("accounts.currency")}</Label>
              <Input
                id="currency_code"
                name="currency_code"
                defaultValue={account?.currency_code ?? "THB"}
                maxLength={3}
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="include_in_net_worth"
              name="include_in_net_worth"
              defaultChecked={account?.include_in_net_worth ?? true}
            />
            <Label htmlFor="include_in_net_worth" className="font-normal">
              {t("accounts.includeInNetWorth")}
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
