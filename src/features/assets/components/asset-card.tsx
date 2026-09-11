"use client";

import { useState, useTransition } from "react";
import {
  Banknote,
  Bitcoin,
  Briefcase,
  Building2,
  Car,
  Coins,
  Home,
  Landmark,
  LineChart,
  MoreVertical,
  PiggyBank,
} from "lucide-react";

import type { Account, Asset, AssetType } from "@/types/database";
import { formatMoneyFromDecimal } from "@/lib/financial/money";
import { deleteAsset } from "@/features/assets/actions";
import { useTranslation } from "@/i18n/client";
import { AssetForm } from "./asset-form";
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

const ASSET_ICONS: Record<AssetType, React.ElementType> = {
  cash: Banknote,
  bank: Landmark,
  savings: PiggyBank,
  investment: LineChart,
  gold: Coins,
  crypto: Bitcoin,
  property: Home,
  vehicle: Car,
  business: Briefcase,
  other: Building2,
};

export function AssetCard({ asset, accounts }: { asset: Asset; accounts: Account[] }) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const Icon = ASSET_ICONS[asset.asset_type];
  const linkedAccount = asset.linked_account_id ? accounts.find((a) => a.id === asset.linked_account_id) : null;

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium leading-none">{asset.name}</p>
              {linkedAccount ? <Badge variant="secondary">{linkedAccount.name}</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t(`assets.types.${asset.asset_type}`)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <p className="font-semibold">{formatMoneyFromDecimal(asset.value, asset.currency_code)}</p>
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
                  if (typeof window !== "undefined" && !window.confirm(t("assets.deleteConfirm"))) return;
                  startTransition(async () => {
                    await deleteAsset(asset.id);
                  });
                }}
              >
                {t("common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
      <AssetForm asset={asset} accounts={accounts} trigger={null} open={editOpen} onOpenChange={setEditOpen} />
    </Card>
  );
}
