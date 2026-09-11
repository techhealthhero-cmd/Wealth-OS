"use client";

import { useActionState, useEffect, useState } from "react";

import { createLiability, updateLiability } from "@/features/liabilities/actions";
import { LIABILITY_TYPES } from "@/lib/validation/liability";
import { useTranslation } from "@/i18n/client";
import type { Liability } from "@/types/database";
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

interface LiabilityFormProps {
  liability?: Liability;
  trigger?: React.ReactElement | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function LiabilityForm({ liability, trigger, open, onOpenChange }: LiabilityFormProps) {
  const { t } = useTranslation();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : uncontrolledOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setUncontrolledOpen;

  const action = liability ? updateLiability.bind(null, liability.id) : createLiability;
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
                {t("liabilities.addLiability")}
              </Button>
            )
          )}
        />
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{liability ? t("liabilities.editLiability") : t("liabilities.addLiability")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("liabilities.name")}</Label>
            <Input id="name" name="name" defaultValue={liability?.name} required maxLength={80} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="liability_type">{t("liabilities.type")}</Label>
            <Select name="liability_type" defaultValue={liability?.liability_type ?? "credit_card"}>
              <SelectTrigger id="liability_type">
                <SelectValue>{(value: string) => t(`liabilities.types.${value}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {LIABILITY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`liabilities.types.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="balance">{t("liabilities.balance")}</Label>
            <Input
              id="balance"
              name="balance"
              type="number"
              step="0.01"
              min="0"
              defaultValue={liability?.balance ?? "0"}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="interest_rate">{t("liabilities.interestRate")}</Label>
              <Input
                id="interest_rate"
                name="interest_rate"
                type="number"
                step="0.01"
                min="0"
                defaultValue={liability?.interest_rate ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minimum_payment">{t("liabilities.minimumPayment")}</Label>
              <Input
                id="minimum_payment"
                name="minimum_payment"
                type="number"
                step="0.01"
                min="0"
                defaultValue={liability?.minimum_payment ?? ""}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="due_date">{t("liabilities.dueDate")}</Label>
            <Input id="due_date" name="due_date" type="date" defaultValue={liability?.due_date ?? ""} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{`${t("liabilities.notes")} (${t("common.optional")})`}</Label>
            <Input id="notes" name="notes" defaultValue={liability?.notes ?? ""} maxLength={500} />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="include_in_net_worth"
              name="include_in_net_worth"
              defaultChecked={liability?.include_in_net_worth ?? true}
            />
            <Label htmlFor="include_in_net_worth" className="font-normal">
              {t("liabilities.includeInNetWorth")}
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
