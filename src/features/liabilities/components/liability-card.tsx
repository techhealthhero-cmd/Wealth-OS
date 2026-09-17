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
  const Icon = LIABILITY_ICONS[liability.liability_type];

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium leading-none">{liability.name}</p>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {t(`liabilities.types.${liability.liability_type}`)}
              {liability.minimum_payment
                ? ` · ${t("liabilities.minimumPaymentShort")}: ${formatMoneyFromDecimal(liability.minimum_payment)}`
                : ""}
              {/* Visible confirmation that this debt is excluded from
                  totalLiabilitiesCents (see calculateNetWorth) — otherwise a
                  user has no way to tell from this card alone whether
                  linking actually took effect. */}
              {liability.linked_account_id ? ` · ${t("liabilities.linkedBadge")}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <p className="font-semibold text-destructive">{formatMoneyFromDecimal(liability.balance)}</p>
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
                onClick={() => {
                  if (typeof window !== "undefined" && !window.confirm(t("liabilities.deleteConfirm"))) return;
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
      <LiabilityForm
        liability={liability}
        creditCardAccounts={creditCardAccounts}
        trigger={null}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </Card>
  );
}
