"use client";

import { cloneElement, useActionState, useEffect, useState, type ReactElement } from "react";

import { upsertQuarterlyPlan } from "@/features/money-year/actions";
import { useTranslation } from "@/i18n/client";
import type { QuarterlyPlan } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMinimizableFormActions } from "@/components/shared/minimizable-form-context";
import { MinimizableFormShell } from "@/components/shared/minimizable-form-shell";

interface QuarterlyPlanFormProps {
  moneyYearId: string;
  quarter: number;
  existing?: QuarterlyPlan;
  trigger: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Thin trigger/open-state wrapper — see goal-form.tsx for why the fields live in a separate, fully self-contained subcomponent. */
export function QuarterlyPlanForm({ moneyYearId, quarter, existing, trigger, open, onOpenChange }: QuarterlyPlanFormProps) {
  const { t } = useTranslation();
  const { openForm, close: closeMinimizable } = useMinimizableFormActions();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : uncontrolledOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setUncontrolledOpen;

  const title = `${existing ? t("moneyYear.editQuarterPlan") : t("moneyYear.addQuarterPlan")} — ${t("moneyYear.quarter")} ${quarter}`;

  useEffect(() => {
    if (dialogOpen) {
      openForm({
        id: `quarterly-plan-form-${moneyYearId}-${quarter}`,
        title,
        content: (
          <QuarterlyPlanFormFields
            moneyYearId={moneyYearId}
            quarter={quarter}
            existing={existing}
            title={title}
            onOpenChange={setDialogOpen}
          />
        ),
      });
    } else {
      closeMinimizable();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen]);

  return cloneElement(trigger as ReactElement<{ onClick?: () => void }>, {
    onClick: () => setDialogOpen(true),
  });
}

function QuarterlyPlanFormFields({
  moneyYearId,
  quarter,
  existing,
  title,
  onOpenChange,
}: {
  moneyYearId: string;
  quarter: number;
  existing?: QuarterlyPlan;
  title: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { close: closeMinimizable } = useMinimizableFormActions();
  const action = upsertQuarterlyPlan.bind(null, moneyYearId);
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
        <input type="hidden" name="quarter" value={quarter} />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="income_target">{t("moneyYear.incomeTarget")}</Label>
            <Input
              id="income_target"
              name="income_target"
              type="number"
              step="any"
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
              step="any"
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
              step="any"
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
              step="any"
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
    </MinimizableFormShell>
  );
}
