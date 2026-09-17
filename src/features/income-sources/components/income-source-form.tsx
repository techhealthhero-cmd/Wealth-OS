"use client";

import { useEffect, useState, useActionState } from "react";

import { createIncomeSource, updateIncomeSource } from "@/features/income-sources/actions";
import { INCOME_SOURCE_TYPES, INCOME_STABILITIES, INCOME_FREQUENCIES } from "@/lib/validation/income-source";
import { useTranslation } from "@/i18n/client";
import type { IncomeSource } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { asTrigger } from "@/lib/as-trigger";

interface IncomeSourceFormProps {
  source?: IncomeSource;
  trigger?: React.ReactElement | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function IncomeSourceForm({ source, trigger, open, onOpenChange }: IncomeSourceFormProps) {
  const { t } = useTranslation();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : uncontrolledOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setUncontrolledOpen;

  const action = source ? updateIncomeSource.bind(null, source.id) : createIncomeSource;
  const [state, formAction, isPending] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.success) setDialogOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {trigger !== null ? (
        <DialogTrigger
          {...asTrigger(
            trigger ?? (
              <Button>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("earn.income.addSource")}
              </Button>
            )
          )}
        />
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{source ? t("earn.income.editSource") : t("earn.income.addSource")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("earn.income.name")}</Label>
            <Input id="name" name="name" defaultValue={source?.name} required maxLength={80} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="source_type">{t("earn.income.type")}</Label>
            <Select name="source_type" defaultValue={source?.source_type ?? "side_hustle"}>
              <SelectTrigger id="source_type">
                <SelectValue>{(value: string) => t(`earn.income.types.${value}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {INCOME_SOURCE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`earn.income.types.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expected_monthly_income">{t("earn.income.expectedMonthlyIncome")}</Label>
            <Input
              id="expected_monthly_income"
              name="expected_monthly_income"
              type="number"
              step="any"
              min="0"
              defaultValue={source?.expected_monthly_income ?? ""}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stability">{t("earn.income.stability")}</Label>
              <Select name="stability" defaultValue={source?.stability ?? "variable"}>
                <SelectTrigger id="stability">
                  <SelectValue>{(value: string) => t(`earn.income.stabilities.${value}`)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {INCOME_STABILITIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`earn.income.stabilities.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="frequency">{t("earn.income.frequency")}</Label>
              <Select name="frequency" defaultValue={source?.frequency ?? "monthly"}>
                <SelectTrigger id="frequency">
                  <SelectValue>{(value: string) => t(`earn.income.frequencies.${value}`)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {INCOME_FREQUENCIES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {t(`earn.income.frequencies.${f}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="is_active" name="is_active" defaultChecked={source?.is_active ?? true} />
            <Label htmlFor="is_active" className="font-normal">
              {t("earn.income.active")}
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{t("earn.income.notes")}</Label>
            <Textarea id="notes" name="notes" defaultValue={source?.notes ?? ""} maxLength={500} />
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
