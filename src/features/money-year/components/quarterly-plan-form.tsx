"use client";

import { useActionState, useEffect, useState } from "react";

import { upsertQuarterlyPlan } from "@/features/money-year/actions";
import { useTranslation } from "@/i18n/client";
import type { QuarterlyPlan } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { asTrigger } from "@/lib/as-trigger";

interface QuarterlyPlanFormProps {
  moneyYearId: string;
  quarter: number;
  existing?: QuarterlyPlan;
  trigger: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function QuarterlyPlanForm({ moneyYearId, quarter, existing, trigger, open, onOpenChange }: QuarterlyPlanFormProps) {
  const { t } = useTranslation();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : uncontrolledOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setUncontrolledOpen;

  const action = upsertQuarterlyPlan.bind(null, moneyYearId);
  const [state, formAction, isPending] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.success) setDialogOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.success]);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger {...asTrigger(trigger)} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {existing ? t("moneyYear.editQuarterPlan") : t("moneyYear.addQuarterPlan")} — {t("moneyYear.quarter")}{" "}
            {quarter}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="quarter" value={quarter} />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="income_target">{t("moneyYear.incomeTarget")}</Label>
              <Input
                id="income_target"
                name="income_target"
                type="number"
                step="0.01"
                min="0"
                defaultValue={existing?.income_target ?? "0"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="savings_target">{t("moneyYear.savingsTarget")}</Label>
              <Input
                id="savings_target"
                name="savings_target"
                type="number"
                step="0.01"
                min="0"
                defaultValue={existing?.savings_target ?? "0"}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="investment_target">{t("moneyYear.investmentTarget")}</Label>
              <Input
                id="investment_target"
                name="investment_target"
                type="number"
                step="0.01"
                min="0"
                defaultValue={existing?.investment_target ?? "0"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="debt_reduction_target">{t("moneyYear.debtReductionTarget")}</Label>
              <Input
                id="debt_reduction_target"
                name="debt_reduction_target"
                type="number"
                step="0.01"
                min="0"
                defaultValue={existing?.debt_reduction_target ?? "0"}
              />
            </div>
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
