"use client";

import { useActionState, useEffect, useState } from "react";

import { createMajorExpense } from "@/features/money-year/actions";
import { useTranslation } from "@/i18n/client";
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

interface MajorExpenseFormProps {
  moneyYearId: string;
  trigger?: React.ReactElement | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MajorExpenseForm({ moneyYearId, trigger, open, onOpenChange }: MajorExpenseFormProps) {
  const { t } = useTranslation();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : uncontrolledOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setUncontrolledOpen;

  const action = createMajorExpense.bind(null, moneyYearId);
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
              <Button variant="outline" size="sm">
                <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                {t("moneyYear.addMajorExpense")}
              </Button>
            )
          )}
        />
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("moneyYear.addMajorExpense")}</DialogTitle>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}
