import { ArrowDownRight, ArrowUpRight, PiggyBank, Wallet } from "lucide-react";

import { formatMoney } from "@/lib/financial/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SummaryCardsLabels {
  income: string;
  expenses: string;
  cashFlow: string;
  savingsRate: string;
}

interface SummaryCardsProps {
  incomeCents: number;
  expensesCents: number;
  cashFlowCents: number;
  savingsRatePercent: number;
  currencyCode: string;
  labels: SummaryCardsLabels;
}

export function SummaryCards({
  incomeCents,
  expensesCents,
  cashFlowCents,
  savingsRatePercent,
  currencyCode,
  labels,
}: SummaryCardsProps) {
  const cards = [
    {
      label: labels.income,
      value: formatMoney(incomeCents, currencyCode),
      icon: ArrowUpRight,
      tone: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: labels.expenses,
      value: formatMoney(expensesCents, currencyCode),
      icon: ArrowDownRight,
      tone: "text-rose-600 dark:text-rose-400",
    },
    {
      label: labels.cashFlow,
      value: formatMoney(cashFlowCents, currencyCode),
      icon: Wallet,
      tone: cashFlowCents < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: labels.savingsRate,
      value: `${savingsRatePercent.toFixed(1)}%`,
      icon: PiggyBank,
      tone: savingsRatePercent < 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.label}
            </CardTitle>
            <card.icon className={cn("h-4 w-4", card.tone)} aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <p className={cn("text-xl font-semibold sm:text-2xl", card.tone)}>{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
