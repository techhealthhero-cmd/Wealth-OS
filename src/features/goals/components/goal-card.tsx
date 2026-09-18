"use client";

import { useState, useTransition } from "react";
import { MoreVertical } from "lucide-react";

import type { Account, FinancialGoal } from "@/types/database";
import { archiveGoal, deleteGoal } from "@/features/goals/actions";
import { useTranslation } from "@/i18n/client";
import { formatMoney, formatMoneyFromDecimal, parseMoneyToCents } from "@/lib/financial/money";
import {
  calculateAmountRemaining,
  calculateGoalProgress,
  calculateGoalScheduleStatus,
  calculateRequiredMonthlyContribution,
} from "@/lib/financial/goals";
import { GoalForm } from "./goal-form";
import { GoalTypeIcon } from "@/components/illustrations";
import { asTrigger } from "@/lib/as-trigger";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirmDialog } from "@/components/shared/confirm-dialog";

const SCHEDULE_BADGE_CLASS: Record<string, string> = {
  achieved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  ahead: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  on_track: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
  behind: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  unknown: "bg-muted text-muted-foreground",
};

export function GoalCard({ goal, accounts }: { goal: FinancialGoal; accounts: Account[] }) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const currentCents = parseMoneyToCents(goal.current_amount);
  const targetCents = parseMoneyToCents(goal.target_amount);
  // target_date is a "YYYY-MM-DD" date-only string — anchor to local midnight
  // rather than letting a bare parse read it as UTC midnight, which shifts a
  // day on any runtime/browser timezone behind UTC.
  const targetDate = goal.target_date ? new Date(`${goal.target_date}T00:00:00`) : null;
  const monthlyCents = parseMoneyToCents(goal.monthly_contribution);

  const progress = calculateGoalProgress(currentCents, targetCents);
  const remaining = calculateAmountRemaining(currentCents, targetCents);
  const requiredMonthly = calculateRequiredMonthlyContribution(currentCents, targetCents, targetDate);
  const schedule = calculateGoalScheduleStatus(currentCents, targetCents, targetDate, monthlyCents);

  const linkedAccount = goal.linked_account_id ? accounts.find((a) => a.id === goal.linked_account_id) : null;

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start justify-between gap-2">
          {/* Mobile overflow fix: a long goal name (Thai custom names run
              long) is a flex child here — without min-w-0 it refuses to
              shrink below its own text width, pushing this row (and the
              page) wider than the viewport instead of truncating. */}
          <div className="flex min-w-0 items-center gap-3">
            <GoalTypeIcon type={goal.goal_type} size={40} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="min-w-0 truncate font-medium leading-none">{goal.name}</p>
                <Badge className={cn("shrink-0", SCHEDULE_BADGE_CLASS[schedule])}>{t(`goals.schedule.${schedule}`)}</Badge>
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {formatMoneyFromDecimal(goal.current_amount)} / {formatMoneyFromDecimal(goal.target_amount)}
                {linkedAccount ? ` · ${linkedAccount.name}` : ""}
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              {...asTrigger(
                <Button variant="ghost" size="icon" aria-label={t("common.moreActions")}>
                  <MoreVertical className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>{t("common.edit")}</DropdownMenuItem>
              <DropdownMenuItem
                disabled={isPending}
                onClick={() => startTransition(async () => { await archiveGoal(goal.id); })}
              >
                {t("common.archive")}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={isPending}
                onClick={async () => {
                  if (!(await confirm(t("goals.deleteConfirm"), { destructive: true }))) return;
                  startTransition(async () => { await deleteGoal(goal.id); });
                }}
              >
                {t("common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-(--motion-value) ease-(--ease-standard)"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <p className="text-muted-foreground">{t("goals.progress")}</p>
            <p className="font-medium">{progress.toFixed(0)}%</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("goals.remaining")}</p>
            <p className="font-medium">{formatMoney(remaining)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("goals.requiredMonthly")}</p>
            <p className="font-medium">{requiredMonthly !== null ? formatMoney(requiredMonthly) : "—"}</p>
          </div>
        </div>
      </CardContent>
      <GoalForm goal={goal} accounts={accounts} trigger={null} open={editOpen} onOpenChange={setEditOpen} />
      {confirmDialog}
    </Card>
  );
}
