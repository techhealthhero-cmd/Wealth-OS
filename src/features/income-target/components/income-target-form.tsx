"use client";

import { useActionState } from "react";

import { saveIncomeTarget } from "@/features/income-target/actions";
import { PREFERRED_INCOME_TYPES, WORK_MODE_PREFERENCES } from "@/lib/validation/income-target";
import { useTranslation } from "@/i18n/client";
import type { IncomeTarget } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function IncomeTargetForm({ target }: { target: IncomeTarget | null }) {
  const { t } = useTranslation();
  const [state, formAction, isPending] = useActionState(saveIncomeTarget, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="target_monthly_income">{t("earn.target.targetMonthlyIncome")}</Label>
          <Input
            id="target_monthly_income"
            name="target_monthly_income"
            type="number"
            step="0.01"
            min="0"
            defaultValue={target?.target_monthly_income ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="desired_extra_income">{t("earn.target.desiredExtraIncome")}</Label>
          <Input
            id="desired_extra_income"
            name="desired_extra_income"
            type="number"
            step="0.01"
            min="0"
            defaultValue={target?.desired_extra_income ?? ""}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="target_date">{t("earn.target.targetDate")}</Label>
          <Input id="target_date" name="target_date" type="date" defaultValue={target?.target_date ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="max_hours_per_week">{t("earn.target.maxHoursPerWeek")}</Label>
          <Input
            id="max_hours_per_week"
            name="max_hours_per_week"
            type="number"
            step="0.5"
            min="0"
            max="168"
            defaultValue={target?.max_hours_per_week ?? ""}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="preferred_income_type">{t("earn.target.preferredIncomeType")}</Label>
          <Select name="preferred_income_type" defaultValue={target?.preferred_income_type ?? "any"}>
            <SelectTrigger id="preferred_income_type">
              <SelectValue>{(value: string) => t(`earn.target.preferredTypes.${value}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PREFERRED_INCOME_TYPES.map((p) => (
                <SelectItem key={p} value={p}>
                  {t(`earn.target.preferredTypes.${p}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="work_mode_preference">{t("earn.target.workModePreference")}</Label>
          <Select name="work_mode_preference" defaultValue={target?.work_mode_preference ?? "any"}>
            <SelectTrigger id="work_mode_preference">
              <SelectValue>{(value: string) => t(`earn.target.workModes.${value}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {WORK_MODE_PREFERENCES.map((w) => (
                <SelectItem key={w} value={w}>
                  {t(`earn.target.workModes.${w}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="max_startup_cost">{t("earn.target.maxStartupCost")}</Label>
        <Input
          id="max_startup_cost"
          name="max_startup_cost"
          type="number"
          step="0.01"
          min="0"
          defaultValue={target?.max_startup_cost ?? ""}
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
