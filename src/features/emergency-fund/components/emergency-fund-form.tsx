"use client";

import { useActionState, useEffect, useState } from "react";

import { saveEmergencyFund } from "@/features/emergency-fund/actions";
import { EMERGENCY_FUND_MONTH_PRESETS } from "@/lib/financial/emergency-fund";
import { useTranslation } from "@/i18n/client";
import type { Account, EmergencyFund, FinancialGoal } from "@/types/database";
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
import { cn } from "@/lib/utils";

const NO_LINK = "__none__";
const CUSTOM = "__custom__";

interface EmergencyFundFormProps {
  emergencyFund: EmergencyFund | null;
  accounts: Account[];
  goals: FinancialGoal[];
}

export function EmergencyFundForm({ emergencyFund, accounts, goals }: EmergencyFundFormProps) {
  const { t } = useTranslation();
  const [state, formAction, isPending] = useActionState(saveEmergencyFund, undefined);
  const [targetMode, setTargetMode] = useState<string>(
    emergencyFund?.target_months ? String(Number(emergencyFund.target_months)) : emergencyFund?.custom_target_amount ? CUSTOM : "6"
  );
  const [linkedAccountId, setLinkedAccountId] = useState(emergencyFund?.linked_account_id ?? NO_LINK);
  const [linkedGoalId, setLinkedGoalId] = useState(emergencyFund?.linked_goal_id ?? NO_LINK);

  useEffect(() => {
    if (state?.success) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="linked_account_id" value={linkedAccountId === NO_LINK ? "" : linkedAccountId} />
      <input type="hidden" name="linked_goal_id" value={linkedGoalId === NO_LINK ? "" : linkedGoalId} />
      <input type="hidden" name="target_months" value={targetMode === CUSTOM ? "" : targetMode} />

      <div className="space-y-2">
        <Label>{t("emergencyFund.targetMonths")}</Label>
        <div className="flex flex-wrap gap-2">
          {EMERGENCY_FUND_MONTH_PRESETS.map((months) => (
            <button
              key={months}
              type="button"
              onClick={() => setTargetMode(String(months))}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                targetMode === String(months)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted"
              )}
            >
              {months} {t("emergencyFund.months")}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setTargetMode(CUSTOM)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              targetMode === CUSTOM
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted"
            )}
          >
            {t("emergencyFund.customTarget")}
          </button>
        </div>
      </div>

      {targetMode === CUSTOM ? (
        <div className="space-y-2">
          <Label htmlFor="custom_target_amount">{t("emergencyFund.customTarget")}</Label>
          <Input
            id="custom_target_amount"
            name="custom_target_amount"
            type="number"
            step="any"
            min="0"
            defaultValue={emergencyFund?.custom_target_amount ?? ""}
            required
          />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="current_amount">{t("emergencyFund.current")}</Label>
          <Input
            id="current_amount"
            name="current_amount"
            type="number"
            step="any"
            min="0"
            defaultValue={emergencyFund?.current_amount ?? "0"}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="monthly_contribution">{t("emergencyFund.monthlyContribution")}</Label>
          <Input
            id="monthly_contribution"
            name="monthly_contribution"
            type="number"
            step="any"
            min="0"
            defaultValue={emergencyFund?.monthly_contribution ?? "0"}
          />
        </div>
      </div>

      {accounts.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="linked_account_display">{t("emergencyFund.linkedAccount")}</Label>
          <Select value={linkedAccountId} onValueChange={(value) => setLinkedAccountId(value ?? NO_LINK)}>
            <SelectTrigger id="linked_account_display">
              <SelectValue>
                {(value: string) =>
                  value === NO_LINK ? t("assets.noLink") : accounts.find((a) => a.id === value)?.name ?? t("assets.noLink")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_LINK}>{t("assets.noLink")}</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {goals.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="linked_goal_display">{t("emergencyFund.linkedGoal")}</Label>
          <Select value={linkedGoalId} onValueChange={(value) => setLinkedGoalId(value ?? NO_LINK)}>
            <SelectTrigger id="linked_goal_display">
              <SelectValue>
                {(value: string) =>
                  value === NO_LINK ? t("assets.noLink") : goals.find((g) => g.id === value)?.name ?? t("assets.noLink")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_LINK}>{t("assets.noLink")}</SelectItem>
              {goals.map((goal) => (
                <SelectItem key={goal.id} value={goal.id}>
                  {goal.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}
