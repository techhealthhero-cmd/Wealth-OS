"use client";

import { cloneElement, useActionState, useEffect, useState, type ReactElement } from "react";

import { createForecastScenario, updateForecastScenario } from "@/features/forecast/actions";
import { FORECAST_SCENARIO_TYPES } from "@/lib/validation/forecast-scenario";
import { useTranslation } from "@/i18n/client";
import type { ForecastAssumptions } from "@/lib/financial/forecast";
import type { ForecastScenario } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useMinimizableFormActions } from "@/components/shared/minimizable-form-context";
import { MinimizableFormShell } from "@/components/shared/minimizable-form-shell";

interface ForecastScenarioFormProps {
  scenario?: ForecastScenario;
  defaults?: ForecastAssumptions;
  trigger?: React.ReactElement | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Thin trigger/open-state wrapper — see goal-form.tsx for why the fields live in a separate, fully self-contained subcomponent. */
export function ForecastScenarioForm({ scenario, defaults, trigger, open, onOpenChange }: ForecastScenarioFormProps) {
  const { t } = useTranslation();
  const { openForm, close: closeMinimizable } = useMinimizableFormActions();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : uncontrolledOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setUncontrolledOpen;

  const formId = scenario ? `forecast-scenario-form-edit-${scenario.id}` : "forecast-scenario-form-add";
  const title = scenario ? t("forecast.editScenario") : t("forecast.addScenario");

  useEffect(() => {
    if (dialogOpen) {
      openForm({
        id: formId,
        title,
        content: (
          <ForecastScenarioFormFields scenario={scenario} defaults={defaults} title={title} onOpenChange={setDialogOpen} />
        ),
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
        {t("forecast.addScenario")}
      </Button>
    );

  return cloneElement(triggerElement as ReactElement<{ onClick?: () => void }>, {
    onClick: () => setDialogOpen(true),
  });
}

function ForecastScenarioFormFields({
  scenario,
  defaults,
  title,
  onOpenChange,
}: {
  scenario?: ForecastScenario;
  defaults?: ForecastAssumptions;
  title: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { close: closeMinimizable } = useMinimizableFormActions();
  const action = scenario ? updateForecastScenario.bind(null, scenario.id) : createForecastScenario;
  const [state, formAction, isPending] = useActionState(action, undefined);

  function handleClose() {
    onOpenChange(false);
    closeMinimizable();
  }

  useEffect(() => {
    if (state?.success) handleClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const defaultMonthlySavings = defaults ? defaults.monthlySavingsCents / 100 : 0;
  const defaultMonthlyInvestment = defaults ? defaults.monthlyInvestmentCents / 100 : 0;
  const defaultMonthlyDebtPayment = defaults ? defaults.monthlyDebtPaymentCents / 100 : 0;

  return (
    <MinimizableFormShell title={title} onClose={handleClose}>
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">{t("forecast.scenarioName")}</Label>
          <Input id="name" name="name" defaultValue={scenario?.name} required maxLength={80} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="scenario_type">{t("forecast.scenario")}</Label>
          <Select name="scenario_type" defaultValue={scenario?.scenario_type ?? "custom"}>
            <SelectTrigger id="scenario_type">
              <SelectValue>{(value: string) => t(`forecast.scenarios.${value}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {FORECAST_SCENARIO_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`forecast.scenarios.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="horizon_months">{t("forecast.horizon")}</Label>
          <Input
            id="horizon_months"
            name="horizon_months"
            type="number"
            min="1"
            max="120"
            defaultValue={scenario?.horizon_months ?? 12}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="income_growth_rate">{t("forecast.incomeGrowthRate")}</Label>
            <Input
              id="income_growth_rate"
              name="income_growth_rate"
              type="number"
              step="0.1"
              defaultValue={scenario?.income_growth_rate ?? "0"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense_growth_rate">{t("forecast.expenseGrowthRate")}</Label>
            <Input
              id="expense_growth_rate"
              name="expense_growth_rate"
              type="number"
              step="0.1"
              defaultValue={scenario?.expense_growth_rate ?? "0"}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="monthly_savings">{t("forecast.monthlySavings")}</Label>
            <Input
              id="monthly_savings"
              name="monthly_savings"
              type="number"
              step="any"
              min="0"
              defaultValue={scenario?.monthly_savings ?? defaultMonthlySavings}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="monthly_investment">{t("forecast.monthlyInvestment")}</Label>
            <Input
              id="monthly_investment"
              name="monthly_investment"
              type="number"
              step="any"
              min="0"
              defaultValue={scenario?.monthly_investment ?? defaultMonthlyInvestment}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="monthly_debt_payment">{t("forecast.monthlyDebtPayment")}</Label>
          <Input
            id="monthly_debt_payment"
            name="monthly_debt_payment"
            type="number"
            step="any"
            min="0"
            defaultValue={scenario?.monthly_debt_payment ?? defaultMonthlyDebtPayment}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="one_time_income">{t("forecast.oneTimeIncome")}</Label>
            <Input
              id="one_time_income"
              name="one_time_income"
              type="number"
              step="any"
              min="0"
              defaultValue={scenario?.one_time_income ?? "0"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="one_time_income_month">{t("forecast.oneTimeIncomeMonth")}</Label>
            <Input
              id="one_time_income_month"
              name="one_time_income_month"
              type="date"
              defaultValue={scenario?.one_time_income_month ?? ""}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="one_time_expense">{t("forecast.oneTimeExpense")}</Label>
            <Input
              id="one_time_expense"
              name="one_time_expense"
              type="number"
              step="any"
              min="0"
              defaultValue={scenario?.one_time_expense ?? "0"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="one_time_expense_month">{t("forecast.oneTimeExpenseMonth")}</Label>
            <Input
              id="one_time_expense_month"
              name="one_time_expense_month"
              type="date"
              defaultValue={scenario?.one_time_expense_month ?? ""}
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
