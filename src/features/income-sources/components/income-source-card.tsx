"use client";

import { useState, useTransition } from "react";
import { MoreVertical } from "lucide-react";

import type { IncomeSource } from "@/types/database";
import { deleteIncomeSource } from "@/features/income-sources/actions";
import { useTranslation } from "@/i18n/client";
import { formatMoneyFromDecimal } from "@/lib/financial/money";
import { IncomeSourceForm } from "./income-source-form";
import { asTrigger } from "@/lib/as-trigger";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function IncomeSourceCard({ source }: { source: IncomeSource }) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-2 py-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium leading-none">{source.name}</p>
            {!source.is_active ? (
              <Badge variant="secondary" className="text-[10px]">
                {t("earn.income.inactive")}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(`earn.income.types.${source.source_type}`)} · {t(`earn.income.stabilities.${source.stability}`)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="font-medium">{formatMoneyFromDecimal(source.expected_monthly_income)}</p>
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
                variant="destructive"
                disabled={isPending}
                onClick={() => {
                  if (typeof window !== "undefined" && !window.confirm(t("earn.income.deleteConfirm"))) return;
                  startTransition(async () => {
                    await deleteIncomeSource(source.id);
                  });
                }}
              >
                {t("common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
      <IncomeSourceForm source={source} trigger={null} open={editOpen} onOpenChange={setEditOpen} />
    </Card>
  );
}
