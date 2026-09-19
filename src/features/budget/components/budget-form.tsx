"use client";

import { cloneElement, useActionState, useEffect, useState, type ReactElement } from "react";

import { createBudget, updateBudget } from "@/features/budget/actions";
import { useTranslation } from "@/i18n/client";
import type { Budget } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { useMinimizableFormActions } from "@/components/shared/minimizable-form-context";
import { MinimizableFormShell } from "@/components/shared/minimizable-form-shell";

interface BudgetFormProps {
  budget?: Budget;
  month: string;
  trigger?: React.ReactElement | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Thin trigger/open-state wrapper — see goal-form.tsx for why the fields live in a separate, fully self-contained subcomponent. */
export function BudgetForm({ budget, month, trigger, open, onOpenChange }: BudgetFormProps) {
  const { t } = useTranslation();
  const { openForm, close: closeMinimizable } = useMinimizableFormActions();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : uncontrolledOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setUncontrolledOpen;

  const formId = budget ? `budget-form-edit-${budget.id}` : `budget-form-add-${month}`;
  const title = budget ? t("budget.editBudget") : t("budget.addBudget");

  useEffect(() => {
    if (dialogOpen) {
      openForm({
        id: formId,
        title,
        content: <BudgetFormFields budget={budget} month={month} title={title} onOpenChange={setDialogOpen} />,
      });
    } else {
      closeMinimizable();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen]);

  if (trigger === null) return null;

  const triggerElement =
    trigger ?? (
      <Button>
        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
        {t("budget.addBudget")}
      </Button>
    );

  return cloneElement(triggerElement as ReactElement<{ onClick?: () => void }>, {
    onClick: () => setDialogOpen(true),
  });
}

function BudgetFormFields({
  budget,
  month,
  title,
  onOpenChange,
}: {
  budget?: Budget;
  month: string;
  title: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { close: closeMinimizable } = useMinimizableFormActions();
  const action = budget ? updateBudget.bind(null, budget.id) : createBudget;
  const [state, formAction, isPending] = useActionState(action, undefined);

  function handleClose() {
    onOpenChange(false);
    closeMinimizable();
  }

  useEffect(() => {
    if (state?.success) handleClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <MinimizableFormShell title={title} onClose={handleClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="month" value={month} />

        <div className="space-y-2">
          <Label htmlFor="total_budget">{t("budget.totalBudget")}</Label>
          <Input
            id="total_budget"
            name="total_budget"
            type="number"
            step="any"
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
              step="any"
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
              step="any"
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
    </MinimizableFormShell>
  );
}
