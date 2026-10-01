"use client";

import { cloneElement, useEffect, useState, useActionState, type ReactElement } from "react";

import { createIncomeSource, updateIncomeSource } from "@/features/income-sources/actions";
import { INCOME_SOURCE_TYPES, INCOME_STABILITIES, INCOME_FREQUENCIES, INCOME_PAY_BASES } from "@/lib/validation/income-source";
import { calculatePerUnitMonthlyCents } from "@/lib/financial/per-unit-income";
import { centsToDecimalString, formatMoney } from "@/lib/financial/money";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/client";
import type { IncomePayBasis, IncomeSource } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useMinimizableFormActions } from "@/components/shared/minimizable-form-context";
import { MinimizableFormShell } from "@/components/shared/minimizable-form-shell";

interface IncomeSourceFormProps {
  source?: IncomeSource;
  trigger?: React.ReactElement | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Thin trigger/open-state wrapper — see goal-form.tsx for why the fields live in a separate, fully self-contained subcomponent. */
export function IncomeSourceForm({ source, trigger, open, onOpenChange }: IncomeSourceFormProps) {
  const { t } = useTranslation();
  const { openForm, close: closeMinimizable } = useMinimizableFormActions();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : uncontrolledOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setUncontrolledOpen;

  const formId = source ? `income-source-form-edit-${source.id}` : "income-source-form-add";
  const title = source ? t("earn.income.editSource") : t("earn.income.addSource");

  useEffect(() => {
    if (dialogOpen) {
      openForm({
        id: formId,
        title,
        content: <IncomeSourceFormFields source={source} title={title} onOpenChange={setDialogOpen} />,
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
        {t("earn.income.addSource")}
      </Button>
    );

  return cloneElement(triggerElement as ReactElement<{ onClick?: () => void }>, {
    onClick: () => setDialogOpen(true),
  });
}

/**
 * "How you're paid": a set monthly amount, or per piece of work (฿200 per
 * drink × drinks in a typical month). The live total here is only a
 * preview — the server recomputes it from rate × units on save.
 */
function PayFields({ source }: { source?: IncomeSource }) {
  const { t } = useTranslation();
  const [basis, setBasis] = useState<IncomePayBasis>(source?.pay_basis ?? "fixed");
  const [rate, setRate] = useState(source?.unit_rate ?? "");
  const [units, setUnits] = useState(source?.expected_units_per_month ?? "");
  const [unitLabel, setUnitLabel] = useState(source?.unit_label ?? "");

  const rateNumber = Number(rate);
  const unitsNumber = Number(units);
  const monthlyCents =
    rate !== "" && units !== "" && Number.isFinite(rateNumber) && Number.isFinite(unitsNumber)
      ? calculatePerUnitMonthlyCents(Math.round(rateNumber * 100), unitsNumber)
      : 0;
  const unitName = unitLabel.trim() || t("earn.income.perUnit.defaultUnit");

  return (
    <div className="space-y-3">
      <input type="hidden" name="pay_basis" value={basis} />
      <div className="space-y-2">
        <Label id="pay-basis-label">{t("earn.income.perUnit.payBasisLabel")}</Label>
        <div role="radiogroup" aria-labelledby="pay-basis-label" className="grid grid-cols-2 gap-2">
          {INCOME_PAY_BASES.map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={basis === b}
              onClick={() => setBasis(b)}
              className={cn(
                "min-h-11 rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                basis === b ? "border-primary bg-primary/10 text-primary dark:text-[#7FD6B2]" : "bg-card hover:bg-muted/50"
              )}
            >
              {t(b === "fixed" ? "earn.income.perUnit.fixed" : "earn.income.perUnit.perUnit")}
            </button>
          ))}
        </div>
      </div>

      {basis === "fixed" ? (
        <div className="space-y-2">
          <Label htmlFor="expected_monthly_income">{t("earn.income.expectedMonthlyIncome")}</Label>
          <Input
            id="expected_monthly_income"
            name="expected_monthly_income"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            defaultValue={source?.expected_monthly_income ?? ""}
            required
          />
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl bg-muted/50 p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="unit_rate">{t("earn.income.perUnit.rate")}</Label>
              <Input id="unit_rate" name="unit_rate" type="number" inputMode="decimal" step="any" min="0" value={rate} onChange={(e) => setRate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit_label">{t("earn.income.perUnit.unitLabel")}</Label>
              <Input
                id="unit_label"
                name="unit_label"
                maxLength={40}
                placeholder={t("earn.income.perUnit.unitPlaceholder")}
                value={unitLabel}
                onChange={(e) => setUnitLabel(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expected_units_per_month">{t("earn.income.perUnit.units")}</Label>
            <Input
              id="expected_units_per_month"
              name="expected_units_per_month"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              required
            />
          </div>
          <input type="hidden" name="expected_monthly_income" value={centsToDecimalString(monthlyCents)} />
          <div aria-live="polite" className="rounded-xl bg-card px-3 py-2.5">
            <p className="text-lg font-bold tabular-nums">{t("earn.income.perUnit.result").replace("{amount}", formatMoney(monthlyCents))}</p>
            {monthlyCents > 0 ? (
              <p className="text-xs text-muted-foreground tabular-nums">
                {t("earn.income.perUnit.formula")
                  .replace("{rate}", formatMoney(Math.round(rateNumber * 100)))
                  .replace("{units}", String(unitsNumber))
                  .replace("{unit}", unitName)}
              </p>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{t("earn.income.perUnit.hint")}</p>
        </div>
      )}
    </div>
  );
}

function IncomeSourceFormFields({
  source,
  title,
  onOpenChange,
}: {
  source?: IncomeSource;
  title: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { close: closeMinimizable } = useMinimizableFormActions();
  const action = source ? updateIncomeSource.bind(null, source.id) : createIncomeSource;
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
          <Label htmlFor="name">{t("earn.income.name")}</Label>
          <Input id="name" name="name" defaultValue={source?.name} required maxLength={80} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="source_type">{t("earn.income.type")}</Label>
          <Select name="source_type" defaultValue={source?.source_type ?? "side_hustle"}>
            <SelectTrigger id="source_type">
              <SelectValue>{(value: string) => t(`earn.income.types.${value}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {INCOME_SOURCE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`earn.income.types.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <PayFields source={source} />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="stability">{t("earn.income.stability")}</Label>
            <Select name="stability" defaultValue={source?.stability ?? "variable"}>
              <SelectTrigger id="stability">
                <SelectValue>{(value: string) => t(`earn.income.stabilities.${value}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {INCOME_STABILITIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`earn.income.stabilities.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="frequency">{t("earn.income.frequency")}</Label>
            <Select name="frequency" defaultValue={source?.frequency ?? "monthly"}>
              <SelectTrigger id="frequency">
                <SelectValue>{(value: string) => t(`earn.income.frequencies.${value}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {INCOME_FREQUENCIES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {t(`earn.income.frequencies.${f}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="is_active" name="is_active" defaultChecked={source?.is_active ?? true} />
          <Label htmlFor="is_active" className="font-normal">
            {t("earn.income.active")}
          </Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">{t("earn.income.notes")}</Label>
          <Textarea id="notes" name="notes" defaultValue={source?.notes ?? ""} maxLength={500} />
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
