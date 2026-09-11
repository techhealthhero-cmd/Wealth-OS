"use client";

import type { Account } from "@/types/database";
import { ACCOUNT_TYPE_EMOJI } from "@/lib/transaction-ui";
import { formatMoneyFromDecimal } from "@/lib/financial/money";
import { useTranslation } from "@/i18n/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AccountPickerProps {
  name: string;
  accounts: Account[];
  value: string | undefined;
  onValueChange: (id: string) => void;
  id?: string;
}

function AccountLabel({ account }: { account: Account }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden="true">{ACCOUNT_TYPE_EMOJI[account.account_type]}</span>
      <span>{account.name}</span>
    </span>
  );
}

/**
 * Presents accounts as friendly icon + name (+ institution/balance) cards —
 * the underlying <select> value is still the account's UUID (name={name}),
 * it's just never shown to the user. See Step 1 of the transaction-entry
 * redesign.
 */
export function AccountPicker({ name, accounts, value, onValueChange, id }: AccountPickerProps) {
  const { t } = useTranslation();

  return (
    <Select
      name={name}
      value={value}
      onValueChange={(v) => {
        if (v) onValueChange(v);
      }}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={t("transactions.selectAccount")}>
          {(selectedId: string | null) => {
            const account = accounts.find((a) => a.id === selectedId);
            return account ? <AccountLabel account={account} /> : t("transactions.selectAccount");
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            <span className="flex w-full items-center justify-between gap-3">
              <span className="flex flex-col">
                <AccountLabel account={account} />
                {account.institution ? (
                  <span className="pl-6 text-xs text-muted-foreground">{account.institution}</span>
                ) : null}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatMoneyFromDecimal(account.current_balance, account.currency_code)}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
