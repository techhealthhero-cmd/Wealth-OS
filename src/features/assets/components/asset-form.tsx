"use client";

import { useActionState, useEffect, useState } from "react";

import { createAsset, updateAsset } from "@/features/assets/actions";
import { ASSET_TYPES } from "@/lib/validation/asset";
import { useTranslation } from "@/i18n/client";
import type { Account, Asset } from "@/types/database";
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

const NO_LINK = "__none__";

interface AssetFormProps {
  asset?: Asset;
  accounts: Account[];
  trigger?: React.ReactElement | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AssetForm({ asset, accounts, trigger, open, onOpenChange }: AssetFormProps) {
  const { t } = useTranslation();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : uncontrolledOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setUncontrolledOpen;
  const [linkedAccountId, setLinkedAccountId] = useState(asset?.linked_account_id ?? NO_LINK);

  const action = asset ? updateAsset.bind(null, asset.id) : createAsset;
  const [state, formAction, isPending] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.success) setDialogOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const linkedAccountLabel = (value: string) =>
    value === NO_LINK ? t("assets.noLink") : accounts.find((a) => a.id === value)?.name ?? t("assets.noLink");

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {trigger !== null ? (
        <DialogTrigger
          {...asTrigger(
            trigger ?? (
              <Button>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("assets.addAsset")}
              </Button>
            )
          )}
        />
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{asset ? t("assets.editAsset") : t("assets.addAsset")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="linked_account_id" value={linkedAccountId === NO_LINK ? "" : linkedAccountId} />

          <div className="space-y-2">
            <Label htmlFor="name">{t("assets.name")}</Label>
            <Input id="name" name="name" defaultValue={asset?.name} required maxLength={80} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="asset_type">{t("assets.type")}</Label>
            <Select name="asset_type" defaultValue={asset?.asset_type ?? "other"}>
              <SelectTrigger id="asset_type">
                <SelectValue>{(value: string) => t(`assets.types.${value}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ASSET_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`assets.types.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="value">{t("assets.value")}</Label>
              <Input
                id="value"
                name="value"
                type="number"
                step="any"
                min="0"
                defaultValue={asset?.value ?? "0"}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency_code">{t("assets.currency")}</Label>
              <Input
                id="currency_code"
                name="currency_code"
                defaultValue={asset?.currency_code ?? "THB"}
                maxLength={3}
                required
              />
            </div>
          </div>

          {accounts.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="linked_account_display">{t("assets.linkedAccount")}</Label>
              <Select value={linkedAccountId} onValueChange={(value) => setLinkedAccountId(value ?? NO_LINK)}>
                <SelectTrigger id="linked_account_display">
                  <SelectValue>{linkedAccountLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_LINK}>{t("assets.noLink")}</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("assets.linkedHint")}</p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="notes">{`${t("assets.notes")} (${t("common.optional")})`}</Label>
            <Input id="notes" name="notes" defaultValue={asset?.notes ?? ""} maxLength={500} />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="include_in_net_worth"
              name="include_in_net_worth"
              defaultChecked={asset?.include_in_net_worth ?? true}
            />
            <Label htmlFor="include_in_net_worth" className="font-normal">
              {t("assets.includeInNetWorth")}
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
