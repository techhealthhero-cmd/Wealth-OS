"use client";

import { cloneElement, useActionState, useEffect, useState, type ReactElement } from "react";

import { createMajorExpense } from "@/features/money-year/actions";
import { useTranslation } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { useMinimizableFormActions } from "@/components/shared/minimizable-form-context";
import { MinimizableFormShell } from "@/components/shared/minimizable-form-shell";

interface MajorExpenseFormProps {
  moneyYearId: string;
  trigger?: React.ReactElement | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Thin trigger/open-state wrapper — see goal-form.tsx for why the fields live in a separate, fully self-contained subcomponent. */
export function MajorExpenseForm({ moneyYearId, trigger, open, onOpenChange }: MajorExpenseFormProps) {
  const { t } = useTranslation();
  const { openForm, close: closeMinimizable } = useMinimizableFormActions();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : uncontrolledOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setUncontrolledOpen;

  const title = t("moneyYear.addMajorExpense");

  useEffect(() => {
    if (dialogOpen) {
      openForm({
        id: `major-expense-form-${moneyYearId}`,
        title,
        content: <MajorExpenseFormFields moneyYearId={moneyYearId} title={title} onOpenChange={setDialogOpen} />,
      });
    } else {
      closeMinimizable();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen]);

  if (trigger === null) return null;

  const triggerElement =
    trigger ?? (
      <Button variant="outline" size="sm">
        <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
        {title}
      </Button>
    );

  return cloneElement(triggerElement as ReactElement<{ onClick?: () => void }>, {
    onClick: () => setDialogOpen(true),
  });
}

function MajorExpenseFormFields({
  moneyYearId,
  title,
  onOpenChange,
}: {
  moneyYearId: string;
  title: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { close: closeMinimizable } = useMinimizableFormActions();
  const action = createMajorExpense.bind(null, moneyYearId);
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
        <div className="space-y-2">
          <Label htmlFor="name">{t("moneyYear.expenseName")}</Label>
          <Input id="name" name="name" required maxLength={120} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">{t("moneyYear.expenseAmount")}</Label>
          <Input id="amount" name="amount" type="number" step="any" min="0" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="planned_month">{t("moneyYear.plannedMonth")}</Label>
          <Input id="planned_month" name="planned_month" type="date" />
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
