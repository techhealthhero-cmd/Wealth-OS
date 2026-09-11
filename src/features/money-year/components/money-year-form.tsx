"use client";

import { useActionState, useEffect, useState } from "react";

import { createMoneyYear, updateMoneyYear } from "@/features/money-year/actions";
import { useTranslation } from "@/i18n/client";
import type { MoneyYear } from "@/types/database";
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

interface MoneyYearFormProps {
  moneyYear?: MoneyYear;
  year: number;
  trigger?: React.ReactElement | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MoneyYearForm({ moneyYear, year, trigger, open, onOpenChange }: MoneyYearFormProps) {
  const { t } = useTranslation();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : uncontrolledOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setUncontrolledOpen;

  const action = moneyYear ? updateMoneyYear.bind(null, moneyYear.id) : createMoneyYear;
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
                {t("moneyYear.addMoneyYear")}
              </Button>
            )
          )}
        />
      ) : null}
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{moneyYear ? t("moneyYear.editMoneyYear") : t("moneyYear.addMoneyYear")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="year" value={year} />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="annual_income_target">{t("moneyYear.annualIncomeTarget")}</Label>
              <Input
                id="annual_income_target"
                name="annual_income_target"
                type="number"
                step="0.01"
                min="0"
                defaultValue={moneyYear?.annual_income_target ?? "0"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="annual_savings_target">{t("moneyYear.annualSavingsTarget")}</Label>
              <Input
                id="annual_savings_target"
                name="annual_savings_target"
                type="number"
                step="0.01"
                min="0"
                defaultValue={moneyYear?.annual_savings_target ?? "0"}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="annual_investment_target">{t("moneyYear.annualInvestmentTarget")}</Label>
              <Input
                id="annual_investment_target"
                name="annual_investment_target"
                type="number"
                step="0.01"
                min="0"
                defaultValue={moneyYear?.annual_investment_target ?? "0"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="annual_debt_reduction_target">{t("moneyYear.annualDebtReductionTarget")}</Label>
              <Input
                id="annual_debt_reduction_target"
                name="annual_debt_reduction_target"
                type="number"
                step="0.01"
                min="0"
                defaultValue={moneyYear?.annual_debt_reduction_target ?? "0"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="annual_emergency_fund_target">{t("moneyYear.annualEmergencyFundTarget")}</Label>
            <Input
              id="annual_emergency_fund_target"
              name="annual_emergency_fund_target"
              type="number"
              step="0.01"
              min="0"
              defaultValue={moneyYear?.annual_emergency_fund_target ?? "0"}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expected_irregular_income">{t("moneyYear.expectedIrregularIncome")}</Label>
              <Input
                id="expected_irregular_income"
                name="expected_irregular_income"
                type="number"
                step="0.01"
                min="0"
                defaultValue={moneyYear?.expected_irregular_income ?? "0"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expected_irregular_expenses">{t("moneyYear.expectedIrregularExpenses")}</Label>
              <Input
                id="expected_irregular_expenses"
                name="expected_irregular_expenses"
                type="number"
                step="0.01"
                min="0"
                defaultValue={moneyYear?.expected_irregular_expenses ?? "0"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{`${t("moneyYear.notes")} (${t("common.optional")})`}</Label>
            <Input id="notes" name="notes" defaultValue={moneyYear?.notes ?? ""} maxLength={500} />
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
