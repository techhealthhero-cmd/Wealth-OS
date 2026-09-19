"use client";

import { cloneElement, useActionState, useEffect, useState, type ReactElement } from "react";

import { upsertBudgetCategory } from "@/features/budget/actions";
import { useTranslation } from "@/i18n/client";
import type { Category } from "@/types/database";
import type { BudgetCategoryWithCategory } from "@/features/budget/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

interface CategoryBudgetFormProps {
  budgetId: string;
  categories: Category[];
  existing?: BudgetCategoryWithCategory;
  trigger?: React.ReactElement | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Thin trigger/open-state wrapper — see goal-form.tsx for why the fields live in a separate, fully self-contained subcomponent. */
export function CategoryBudgetForm({
  budgetId,
  categories,
  existing,
  trigger,
  open,
  onOpenChange,
}: CategoryBudgetFormProps) {
  const { t } = useTranslation();
  const { openForm, close: closeMinimizable } = useMinimizableFormActions();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : uncontrolledOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setUncontrolledOpen;

  const title = t("budget.addCategoryBudget");
  const formId = existing ? `category-budget-form-edit-${existing.id}` : `category-budget-form-add-${budgetId}`;

  useEffect(() => {
    if (dialogOpen) {
      openForm({
        id: formId,
        title,
        content: (
          <CategoryBudgetFormFields
            budgetId={budgetId}
            categories={categories}
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

  if (trigger === null) return null;

  const triggerElement =
    trigger ?? (
      <Button variant="outline" size="sm">
        <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
        {title}
      </Button>
    );

  return cloneElement(triggerElement as ReactElement<{ onClick?: () => void }>, {
    onClick: () => setDialogOpen(true),
  });
}

function CategoryBudgetFormFields({
  budgetId,
  categories,
  existing,
  title,
  onOpenChange,
}: {
  budgetId: string;
  categories: Category[];
  existing?: BudgetCategoryWithCategory;
  title: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, locale } = useTranslation();
  const { close: closeMinimizable } = useMinimizableFormActions();
  const action = upsertBudgetCategory.bind(null, budgetId);
  const [state, formAction, isPending] = useActionState(action, undefined);

  function handleClose() {
    onOpenChange(false);
    closeMinimizable();
  }

  useEffect(() => {
    if (state?.success) handleClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const categoryName = (c: Category) => (locale === "th" ? c.name_th : c.name_en);

  return (
    <MinimizableFormShell title={title} onClose={handleClose}>
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="category_id">{t("transactions.category")}</Label>
          <Select name="category_id" defaultValue={existing?.category_id}>
            <SelectTrigger id="category_id">
              <SelectValue placeholder={t("transactions.selectCategory")}>
                {(value: string) => categories.find((c) => c.id === value)?.[locale === "th" ? "name_th" : "name_en"]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {categoryName(category)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">{t("budget.totalBudget")}</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="any"
            min="0"
            defaultValue={existing?.amount ?? "0"}
            required
          />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="is_fixed" name="is_fixed" defaultChecked={existing?.is_fixed ?? false} />
          <Label htmlFor="is_fixed" className="font-normal">
            {t("budget.fixed")}
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="is_essential" name="is_essential" defaultChecked={existing?.is_essential ?? true} />
          <Label htmlFor="is_essential" className="font-normal">
            {t("budget.essential")}
          </Label>
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
