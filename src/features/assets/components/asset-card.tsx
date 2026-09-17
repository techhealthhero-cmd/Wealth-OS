"use client";

import { useState, useTransition } from "react";
import {
  Banknote,
  Bitcoin,
  Briefcase,
  Building2,
  Camera,
  Car,
  Coins,
  Home,
  Landmark,
  Laptop,
  LineChart,
  MoreVertical,
  PiggyBank,
  Smartphone,
  Watch,
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
import { useConfirmDialog } from "@/components/shared/confirm-dialog";

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

// There's no dedicated AssetType for gadgets/electronics — they legitimately
// fall under "other" (adding a whole new type + migration for icon choice
// alone isn't worth it). This narrows the generic building icon to
// something recognizable for the common cases, purely cosmetic — asset_type
// itself, and every calculation that reads it, is unaffected.
const OTHER_ASSET_ICONS = {
  laptop: Laptop,
  smartphone: Smartphone,
  camera: Camera,
  watch: Watch,
} as const;

const OTHER_ASSET_ICON_KEYWORDS: { key: keyof typeof OTHER_ASSET_ICONS; keywords: string[] }[] = [
  { key: "laptop", keywords: ["โนตบุค", "notebook", "laptop", "macbook"] },
  { key: "smartphone", keywords: ["โทรศัพท", "มือถือ", "iphone", "smartphone", "phone"] },
  { key: "camera", keywords: ["กลอง", "camera"] },
  { key: "watch", keywords: ["นาฬิกา", "watch"] },
];

// Thai loanwords like "notebook" have no single standardized spelling —
// โน้ตบุ๊ค / โน๊ตบุ๊ค / โน้ตบุ้ค / โน๊ตบุ้ค all appear in casual use, differing
// only by which tone mark sits on which syllable. Stripping tone marks
// (Unicode combining marks U+0E48-U+0E4B) from both sides before matching
// normalizes every variant to the same base spelling instead of trying to
// enumerate all of them.
function stripThaiToneMarks(s: string): string {
  return s.replace(/[่-๋]/g, "");
}

function matchOtherAssetIconKey(name: string): keyof typeof OTHER_ASSET_ICONS | null {
  const normalized = stripThaiToneMarks(name.toLowerCase());
  const match = OTHER_ASSET_ICON_KEYWORDS.find((entry) =>
    entry.keywords.some((keyword) => normalized.includes(stripThaiToneMarks(keyword.toLowerCase())))
  );
  return match?.key ?? null;
}

export function AssetCard({ asset, accounts }: { asset: Asset; accounts: Account[] }) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const otherIconKey = asset.asset_type === "other" ? matchOtherAssetIconKey(asset.name) : null;
  const Icon = otherIconKey ? OTHER_ASSET_ICONS[otherIconKey] : ASSET_ICONS[asset.asset_type];
  const linkedAccount = asset.linked_account_id ? accounts.find((a) => a.id === asset.linked_account_id) : null;

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="min-w-0 truncate font-medium leading-none">{asset.name}</p>
              {linkedAccount ? (
                <Badge variant="secondary" className="max-w-[8rem] shrink-0 truncate">
                  {linkedAccount.name}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">{t(`assets.types.${asset.asset_type}`)}</p>
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
                onClick={async () => {
                  if (!(await confirm(t("assets.deleteConfirm"), { destructive: true }))) return;
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
      {confirmDialog}
    </Card>
  );
}
