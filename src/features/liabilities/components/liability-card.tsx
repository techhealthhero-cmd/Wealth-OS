"use client";

import { useState, useTransition } from "react";
import { Building2, Car, CreditCard, GraduationCap, HandCoins, Home, MoreVertical } from "lucide-react";

import type { Account, Liability, LiabilityType } from "@/types/database";
import { formatMoneyFromDecimal } from "@/lib/financial/money";
import { deleteLiability } from "@/features/liabilities/actions";
import { useTranslation } from "@/i18n/client";
import { LiabilityForm } from "./liability-form";
import { asTrigger } from "@/lib/as-trigger";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirmDialog } from "@/components/shared/confirm-dialog";
import { FlipCard } from "@/components/shared/flip-card";
import { setLiabilityCardClosed, useLiabilityCardClosed } from "@/features/liabilities/closed-cards";

const LIABILITY_ICONS: Record<LiabilityType, React.ElementType> = {
  credit_card: CreditCard,
  personal_loan: HandCoins,
  car_loan: Car,
  mortgage: Home,
  student_loan: GraduationCap,
  informal_debt: HandCoins,
  other: Building2,
};

export function LiabilityCard({
  liability,
  creditCardAccounts = [],
}: {
  liability: Liability;
  creditCardAccounts?: Account[];
}) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const Icon = LIABILITY_ICONS[liability.liability_type];
  const closed = useLiabilityCardClosed(liability.id);
  const typeLabel = t(`liabilities.types.${liability.liability_type}`);
  // Visible confirmation that this debt is excluded from
  // totalLiabilitiesCents (see calculateNetWorth) — otherwise a user has no
  // way to tell from this card alone whether linking actually took effect.
  const linkedSuffix = liability.linked_account_id ? ` · ${t("liabilities.linkedBadge")}` : "";

  // Shared by both faces; only the front's subtitle carries the minimum
  // payment, since the back shows no amounts.
  const identity = (subtitle: string) => (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        {/* leading-tight, not leading-none — see transaction-row.tsx's title for why (Thai tone-mark clipping). */}
        <p className="truncate font-medium leading-tight">{liability.name}</p>
        <p className="mt-1 truncate text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );

  return (
    <FlipCard
      closed={closed}
      onToggle={(next) => setLiabilityCardClosed(liability.id, next)}
      name={liability.name}
      front={
        <Card>
          <CardContent className="flex items-center justify-between gap-4 py-4">
            {identity(
              typeLabel +
                (liability.minimum_payment
                  ? ` · ${t("liabilities.minimumPaymentShort")}: ${formatMoneyFromDecimal(liability.minimum_payment)}`
                  : "") +
                linkedSuffix
            )}

            <div className="flex shrink-0 items-center gap-2">
              <p className="whitespace-nowrap font-semibold text-destructive">{formatMoneyFromDecimal(liability.balance)}</p>
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
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={isPending}
                    onClick={async () => {
                      if (!(await confirm(t("liabilities.deleteConfirm"), { destructive: true }))) return;
                      startTransition(async () => {
                        await deleteLiability(liability.id);
                      });
                    }}
                  >
                    {t("common.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      }
      // The back: the debt's type where its balance was — no amounts at all.
      back={
        <Card>
          <CardContent className="flex h-full items-center justify-between gap-4 py-4">
            {identity(typeLabel + linkedSuffix)}
            <span className="max-w-[45%] shrink-0 truncate rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {typeLabel}
            </span>
          </CardContent>
        </Card>
      }
    >
      <LiabilityForm
        liability={liability}
        creditCardAccounts={creditCardAccounts}
        trigger={null}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      {confirmDialog}
    </FlipCard>
  );
}
