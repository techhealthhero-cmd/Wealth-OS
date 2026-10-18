"use client";

import { useRef, useState, useTransition } from "react";
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

const ACCOUNT_ICONS: Record<AccountType, React.ElementType> = {
  cash: Banknote,
  bank: Landmark,
  savings: PiggyBank,
  e_wallet: Smartphone,
  credit_card: CreditCard,
  investment: LineChart,
  other: Building2,
};

// A press held longer than this is the list's long-press-to-drag (see
// sortable-account-list.tsx's 250ms activation delay), not a tap to flip.
const TAP_MAX_MS = 250;

/**
 * One account, as a card that flips top-over-bottom: tap it to turn it face-down (name only,
 * balance covered), tap again to turn it back. Both faces share one grid
 * cell, so the card keeps its height through the turn.
 */
export function AccountCard({ account }: { account: Account }) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const closed = useAccountCardClosed(account.id);
  // Only animate flips the viewer makes: a card remembered as closed
  // appears closed on load instead of spinning shut.
  const [animate, setAnimate] = useState(false);
  const pressStart = useRef(0);
  const Icon = ACCOUNT_ICONS[account.account_type];
  const balanceCents = Number(account.current_balance) * 100;
  const subtitle = account.institution ?? t(`accounts.types.${account.account_type}`);

  function handleTap(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    // Clicks bubble here from the portalled menu and dialogs too (React
    // events follow the component tree), and the ⋮ button has its own job.
    if (!event.currentTarget.contains(target) || target.closest("button, a, input, textarea, select")) return;
    if (Date.now() - pressStart.current > TAP_MAX_MS) return;
    setAnimate(true);
    setAccountCardClosed(account.id, !closed);
  }

  const iconChip = (surface: string) => (
    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", surface)}>
      <Icon className="h-5 w-5" aria-hidden="true" />
    </div>
  );

  return (
    <div
      className="cursor-pointer perspective-[1200px]"
      onPointerDown={() => {
        pressStart.current = Date.now();
      }}
      onClick={handleTap}
    >
      <div
        className={cn(
          "grid transform-3d",
          animate && "transition-transform duration-500 ease-in-out motion-reduce:transition-none",
          closed && "rotate-x-180"
        )}
      >
        <Card className="col-start-1 row-start-1 backface-hidden" inert={closed} aria-hidden={closed}>
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

        {/* The back: dot-grid notebook paper, the name kept so the list still reads. */}
        <Card
          variant="soft"
          className="col-start-1 row-start-1 rotate-x-180 backface-hidden ring-1 ring-foreground/5"
          inert={!closed}
          aria-hidden={!closed}
        >
          <CardContent className="flex h-full items-center justify-between gap-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
              {iconChip("bg-card")}
              <div className="min-w-0">
                <p className="min-w-0 truncate font-medium leading-tight">{account.name}</p>
                <p className="mt-1 truncate text-sm text-muted-foreground">{t("accounts.cardTapToOpen")}</p>
              </div>
            </div>
            <p className="shrink-0 text-right text-sm font-medium text-muted-foreground">
              <span aria-hidden="true" className="mr-1 tracking-widest">••••</span>
              {t("accounts.cardClosedBalance")}
            </p>
          </CardContent>
        </Card>
      </div>

      <AccountForm
        account={account}
        trigger={null}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      {confirmDialog}
    </div>
  );
}
