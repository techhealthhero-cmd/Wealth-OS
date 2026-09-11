"use client";

import { useActionState, useEffect, useState } from "react";

import { createBudget, updateBudget } from "@/features/budget/actions";
import { useTranslation } from "@/i18n/client";
import type { Budget } from "@/types/database";
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
import { Plus } from "lucide-react";
import { asTrigger } from "@/lib/as-trigger";

interface BudgetFormProps {
  budget?: Budget;
  month: string;
  trigger?: React.ReactElement | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function BudgetForm({ budget, month, trigger, open, onOpenChange }: BudgetFormProps) {
  const { t } = useTranslation();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : uncontrolledOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setUncontrolledOpen;

  const action = budget ? updateBudget.bind(null, budget.id) : createBudget;
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
                {t("budget.addBudget")}
              </Button>
            )
          )}
        />
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{budget ? t("budget.editBudget") : t("budget.addBudget")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="month" value={month} />

          <div className="space-y-2">
            <Label htmlFor="total_budget">{t("budget.totalBudget")}</Label>
            <Input
              id="total_budget"
              name="total_budget"
              type="number"
              step="0.01"
              min="0"
              defaultValue={budget?.total_budget ?? "0"}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="planned_savings">{t("budget.plannedSavings")}</Label>
              <Input
                id="planned_savings"
                name="planned_savings"
                type="number"
                step="0.01"
                min="0"
                defaultValue={budget?.planned_savings ?? "0"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="planned_investment">{t("budget.plannedInvestment")}</Label>
              <Input
                id="planned_investment"
                name="planned_investment"
                type="number"
                step="0.01"
                min="0"
                defaultValue={budget?.planned_investment ?? "0"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{`${t("budget.notes")} (${t("common.optional")})`}</Label>
            <Input id="notes" name="notes" defaultValue={budget?.notes ?? ""} maxLength={500} />
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
