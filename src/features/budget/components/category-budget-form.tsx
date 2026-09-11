"use client";

import { useActionState, useEffect, useState } from "react";

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { asTrigger } from "@/lib/as-trigger";

interface CategoryBudgetFormProps {
  budgetId: string;
  categories: Category[];
  existing?: BudgetCategoryWithCategory;
  trigger?: React.ReactElement | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CategoryBudgetForm({
  budgetId,
  categories,
  existing,
  trigger,
  open,
  onOpenChange,
}: CategoryBudgetFormProps) {
  const { t, locale } = useTranslation();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : uncontrolledOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setUncontrolledOpen;

  const action = upsertBudgetCategory.bind(null, budgetId);
  const [state, formAction, isPending] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.success) setDialogOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.success]);

  const categoryName = (c: Category) => (locale === "th" ? c.name_th : c.name_en);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {trigger !== null ? (
        <DialogTrigger
          {...asTrigger(
            trigger ?? (
              <Button variant="outline" size="sm">
                <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                {t("budget.addCategoryBudget")}
              </Button>
            )
          )}
        />
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("budget.addCategoryBudget")}</DialogTitle>
        </DialogHeader>
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
              step="0.01"
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
      </DialogContent>
    </Dialog>
  );
}
