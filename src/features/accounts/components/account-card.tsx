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
import { cn } from "@/lib/utils";
import { archiveAccount, unarchiveAccount } from "@/features/accounts/actions";
import { setAccountCardClosed, useAccountCardClosed } from "@/features/accounts/closed-cards";
import { PURPOSE_PRESET_INDEXES, purposePillClass } from "@/features/accounts/purpose";
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
import { useConfirmDialog } from "@/components/shared/confirm-dialog";
import { FlipCard } from "@/components/shared/flip-card";

const ACCOUNT_ICONS: Record<AccountType, React.ElementType> = {
  cash: Banknote,
  bank: Landmark,
  savings: PiggyBank,
  e_wallet: Smartphone,
  credit_card: CreditCard,
  investment: LineChart,
  other: Building2,
};

/**
 * One account, as a card that flips (see FlipCard): the back shows what the
 * money is for instead of the balance.
 */
export function AccountCard({ account }: { account: Account }) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const closed = useAccountCardClosed(account.id);
  const Icon = ACCOUNT_ICONS[account.account_type];
  const balanceCents = Number(account.current_balance) * 100;
  const subtitle = account.institution ?? t(`accounts.types.${account.account_type}`);
  // No purpose set (or before migration 0045): the account type stands in.
  const purposeLabel = account.purpose?.trim() || t(`accounts.types.${account.account_type}`);
  const presets = PURPOSE_PRESET_INDEXES.map((i) => t(`accounts.purposePresets.${i}`));

  const iconChip = (surface: string) => (
    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", surface)}>
      <Icon className="h-5 w-5" aria-hidden="true" />
    </div>
  );

  return (
    <FlipCard
      closed={closed}
      onToggle={(next) => setAccountCardClosed(account.id, next)}
      name={account.name}
      front={
        <Card>
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
              {iconChip("bg-muted")}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {/* leading-tight, not leading-none — see transaction-row.tsx's title for why (Thai tone-mark clipping). */}
                  <p className="min-w-0 truncate font-medium leading-tight">{account.name}</p>
                  {account.is_archived ? (
                    <Badge variant="secondary" className="shrink-0">{t("accounts.archived")}</Badge>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">{subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right">
                <p
                  className={
                    balanceCents < 0
                      ? "font-semibold text-destructive"
                      : "font-semibold"
                  }
                >
                  {formatMoneyFromDecimal(account.current_balance, account.currency_code)}
                </p>
                {account.account_type === "credit_card" && balanceCents < 0 ? (
                  <p className="text-xs text-muted-foreground">{t("accounts.creditCardBalanceLabel")}</p>
                ) : null}
              </div>
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
                  {account.is_archived ? (
                    <DropdownMenuItem
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await unarchiveAccount(account.id);
                        })
                      }
                    >
                      {t("common.unarchive")}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      disabled={isPending}
                      onClick={async () => {
                        // Archiving hides the account from the main list with no
                        // way back except the confirmation's own promise — see
                        // UX_GUIDELINES.md #18 (destructive/high-impact actions
                        // must explain consequences).
                        if (!(await confirm(t("accounts.archiveConfirm")))) return;
                        startTransition(async () => {
                          await archiveAccount(account.id);
                        });
                      }}
                    >
                      {t("common.archive")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      }
      // The back: same paper and layout as the front, with what the money is
      // for where the balance was — it reads as an ordinary card.
      back={
        <Card>
          <CardContent className="flex h-full items-center justify-between gap-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
              {iconChip("bg-muted")}
              <div className="min-w-0">
                <p className="min-w-0 truncate font-medium leading-tight">{account.name}</p>
                <p className="mt-1 truncate text-sm text-muted-foreground">{subtitle}</p>
              </div>
            </div>
            <span
              className={cn(
                "max-w-[45%] shrink-0 truncate rounded-full px-2.5 py-1 text-xs font-medium",
                purposePillClass(purposeLabel, presets)
              )}
            >
              {purposeLabel}
            </span>
          </CardContent>
        </Card>
      }
    >
      <AccountForm
        account={account}
        trigger={null}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      {confirmDialog}
    </FlipCard>
  );
}
