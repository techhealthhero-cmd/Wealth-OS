"use client";

import { useState, useTransition } from "react";
import {
  Banknote,
  Building2,
  CreditCard,
  Landmark,
  LineChart,
  MoreVertical,
  PiggyBank,
  Smartphone,
} from "lucide-react";

import type { Account, AccountType } from "@/types/database";
import { formatMoneyFromDecimal } from "@/lib/financial/money";
import { archiveAccount } from "@/features/accounts/actions";
import { useTranslation } from "@/i18n/client";
import { AccountForm } from "./account-form";
import { asTrigger } from "@/lib/as-trigger";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ACCOUNT_ICONS: Record<AccountType, React.ElementType> = {
  cash: Banknote,
  bank: Landmark,
  savings: PiggyBank,
  e_wallet: Smartphone,
  credit_card: CreditCard,
  investment: LineChart,
  other: Building2,
};

export function AccountCard({ account }: { account: Account }) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const Icon = ACCOUNT_ICONS[account.account_type];
  const balanceCents = Number(account.current_balance) * 100;

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium leading-none">{account.name}</p>
              {account.is_archived ? (
                <Badge variant="secondary">{t("accounts.archived")}</Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {account.institution ?? t(`accounts.types.${account.account_type}`)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <p
            className={
              balanceCents < 0
                ? "font-semibold text-destructive"
                : "font-semibold"
            }
          >
            {formatMoneyFromDecimal(account.current_balance, account.currency_code)}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger
              {...asTrigger(
                <Button variant="ghost" size="icon" aria-label={t("common.moreActions")}>
                  <MoreVertical className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>{t("common.edit")}</DropdownMenuItem>
              {!account.is_archived && (
                <DropdownMenuItem
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await archiveAccount(account.id);
                    })
                  }
                >
                  {t("common.archive")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
      <AccountForm
        account={account}
        trigger={null}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </Card>
  );
}
