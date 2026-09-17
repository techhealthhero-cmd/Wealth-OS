"use client";

import { useActionState } from "react";

import { saveDebtPlan } from "@/features/debt-planner/actions";
import { DEBT_STRATEGIES } from "@/lib/validation/debt-plan";
import { useTranslation } from "@/i18n/client";
import type { DebtPlan } from "@/types/database";
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

export function DebtPlanForm({ plan }: { plan: DebtPlan | null }) {
  const { t } = useTranslation();
  const [state, formAction, isPending] = useActionState(saveDebtPlan, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="strategy">{t("debtPlanner.strategy")}</Label>
        <Select name="strategy" defaultValue={plan?.strategy ?? "avalanche"}>
          <SelectTrigger id="strategy">
            <SelectValue>{(value: string) => t(`debtPlanner.strategies.${value}`)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {DEBT_STRATEGIES.map((strategy) => (
              <SelectItem key={strategy} value={strategy}>
                {t(`debtPlanner.strategies.${strategy}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="extra_monthly_payment">{t("debtPlanner.extraMonthlyPayment")}</Label>
        <Input
          id="extra_monthly_payment"
          name="extra_monthly_payment"
          type="number"
          step="any"
          min="0"
          defaultValue={plan?.extra_monthly_payment ?? "0"}
        />
      </div>

      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}
