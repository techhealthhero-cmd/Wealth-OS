"use client";

import { useActionState, useEffect, useState } from "react";

import { createGoal, updateGoal } from "@/features/goals/actions";
import { GOAL_PRIORITIES, GOAL_TYPES } from "@/lib/validation/goal";
import { useTranslation } from "@/i18n/client";
import type { Account, FinancialGoal } from "@/types/database";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { asTrigger } from "@/lib/as-trigger";

const NO_LINK = "__none__";

interface GoalFormProps {
  goal?: FinancialGoal;
  accounts: Account[];
  trigger?: React.ReactElement | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function GoalForm({ goal, accounts, trigger, open, onOpenChange }: GoalFormProps) {
  const { t } = useTranslation();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : uncontrolledOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setUncontrolledOpen;
  const [linkedAccountId, setLinkedAccountId] = useState(goal?.linked_account_id ?? NO_LINK);

  const action = goal ? updateGoal.bind(null, goal.id) : createGoal;
  const [state, formAction, isPending] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.success) setDialogOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const linkedAccountLabel = (value: string) =>
    value === NO_LINK ? t("assets.noLink") : accounts.find((a) => a.id === value)?.name ?? t("assets.noLink");

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {trigger !== null ? (
        <DialogTrigger
          {...asTrigger(
            trigger ?? (
              <Button>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("goals.addGoal")}
              </Button>
            )
          )}
        />
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{goal ? t("goals.editGoal") : t("goals.addGoal")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="linked_account_id" value={linkedAccountId === NO_LINK ? "" : linkedAccountId} />

          <div className="space-y-2">
            <Label htmlFor="name">{t("goals.name")}</Label>
            <Input id="name" name="name" defaultValue={goal?.name} required maxLength={80} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal_type">{t("goals.type")}</Label>
            <Select name="goal_type" defaultValue={goal?.goal_type ?? "custom"}>
              <SelectTrigger id="goal_type">
                <SelectValue>{(value: string) => t(`goals.types.${value}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {GOAL_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`goals.types.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target_amount">{t("goals.targetAmount")}</Label>
              <Input
                id="target_amount"
                name="target_amount"
                type="number"
                step="any"
                min="0"
                defaultValue={goal?.target_amount ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="current_amount">{t("goals.currentAmount")}</Label>
              <Input
                id="current_amount"
                name="current_amount"
                type="number"
                step="any"
                min="0"
                defaultValue={goal?.current_amount ?? "0"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target_date">{t("goals.targetDate")}</Label>
            <Input id="target_date" name="target_date" type="date" defaultValue={goal?.target_date ?? ""} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">{t("goals.priority")}</Label>
              <Select name="priority" defaultValue={goal?.priority ?? "medium"}>
                <SelectTrigger id="priority">
                  <SelectValue>{(value: string) => t(`goals.priorities.${value}`)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {GOAL_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(`goals.priorities.${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthly_contribution">{t("goals.monthlyContribution")}</Label>
              <Input
                id="monthly_contribution"
                name="monthly_contribution"
                type="number"
                step="any"
                min="0"
                defaultValue={goal?.monthly_contribution ?? "0"}
              />
            </div>
          </div>

          {accounts.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="linked_account_display">{t("goals.linkedAccount")}</Label>
              <Select value={linkedAccountId} onValueChange={(value) => setLinkedAccountId(value ?? NO_LINK)}>
                <SelectTrigger id="linked_account_display">
                  <SelectValue>{linkedAccountLabel}</SelectValue>
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
